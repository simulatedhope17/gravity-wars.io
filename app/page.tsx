"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import MobileControls from './components/MobileControls'

// Game constants
const CANVAS_WIDTH = 1200
const CANVAS_HEIGHT = 800
const GRAVITY_CONSTANT = 1.5
const MAX_VELOCITY = 4
const COMPASS_SIZE = 140
const ENERGY_DECAY_RATE = 0.08
const GRAVITY_PULL_COST = 3
const CHARGING_RADIUS = 400
const GRAVITY_PULL_RADIUS = 250
const GRAVITY_PULL_STRENGTH = 0.3
const ORBITAL_ABSORPTION_RATE = 0.001
const AI_GROWTH_RATE = 0.0002
const AI_MAX_MASS = 40
const PLAYER_START_MASS = 8
const PLAYER_START_ENERGY = 80
const PLAYER_MAX_ENERGY = 120
const ENERGY_ABSORPTION_RATE = 0.5
const MASS_ABSORPTION_RATE = 0.8

// Add WebSocket connection state
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

type ObjectType =
  | "player"
  | "ai"
  | "debris"
  | "planet"
  | "star"
  | "blackhole"
  | "whitedwarf"
  | "wormhole"
  | "pulsar"
  | "neutronstar"
  | "comet"
  | "asteroid"
  | "spacestation"
  | "anomaly"

interface GameObject {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  mass: number
  radius: number
  type: ObjectType
  color: string
  energy?: number
  maxEnergy?: number
  isGlowing?: boolean
  chargingRate?: number
  linkedWormhole?: string
  isLandmark?: boolean
  pulsePhase?: number
  orbitAngle?: number
  orbitSpeed?: number
  orbitRadius?: number
  orbitCenter?: { x: number; y: number }
  isOrbiting?: boolean
  orbitingTarget?: string
  absorptionProgress?: number
  lastMovementTime?: number
  aiTarget?: string
  aiState?: "hunting" | "fleeing" | "exploring" | "charging"
}

interface GravityForce {
  direction: number
  strength: number
  source: GameObject
  color: string
}

interface CosmicEvent {
  id: string
  type:
    | "solarFlare"
    | "meteorShower"
    | "wormholeStorm"
    | "solarWind"
    | "coronalMassEjection"
    | "magneticStorm"
    | "nebula"
    | "asteroidBelt"
    | "quantumAnomaly"
  x: number
  y: number
  vx?: number
  vy?: number
  duration: number
  timeLeft: number
  radius: number
  direction?: number
  intensity?: number
  rewards?: number
}

interface SpaceActivity {
  id: string
  type: "derelictShip" | "ancientRelic" | "energyCrystal" | "spaceWhale" | "alienStructure"
  x: number
  y: number
  radius: number
  color: string
  reward: number
  discovered: boolean
  description: string
}

const PauseMenu = ({ onResume, onRespawn, stats }: { 
  onResume: () => void, 
  onRespawn: () => void,
  stats: { score: number, mass: number, energy: number, discoveries: number }
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100]">
    <Card className="p-8 text-center bg-gray-900 border-cyan-500 max-w-md mx-4">
      <h2 className="text-3xl font-bold text-cyan-400 mb-4">PAUSED</h2>
      
      {/* Game Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-left">
        <div className="p-3 bg-gray-800 rounded-lg">
          <div className="text-cyan-400 font-bold">SCORE</div>
          <div className="text-2xl">{stats.score}</div>
        </div>
        <div className="p-3 bg-gray-800 rounded-lg">
          <div className="text-cyan-400 font-bold">MASS</div>
          <div className="text-2xl">{stats.mass.toFixed(1)}</div>
        </div>
        <div className="p-3 bg-gray-800 rounded-lg">
          <div className="text-cyan-400 font-bold">ENERGY</div>
          <div className="text-2xl">{stats.energy.toFixed(0)}</div>
        </div>
        <div className="p-3 bg-gray-800 rounded-lg">
          <div className="text-cyan-400 font-bold">DISCOVERIES</div>
          <div className="text-2xl">{stats.discoveries}</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button 
          onClick={onResume} 
          className="bg-cyan-600 hover:bg-cyan-700 w-full py-3 text-lg font-bold"
        >
          RESUME
        </Button>
        <Button 
          onClick={onRespawn} 
          className="bg-red-600 hover:bg-red-700 w-full py-3 text-lg font-bold"
        >
          RESPAWN
        </Button>
      </div>
    </Card>
  </div>
)

export default function GravityWarsGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const keysRef = useRef<Set<string>>(new Set())
  const gameObjectsRef = useRef<GameObject[]>([])
  const playerRef = useRef<GameObject | null>(null)
  const gravityForcesRef = useRef<GravityForce[]>([])
  const cameraRef = useRef({ x: 0, y: 0 })
  const cosmicEventsRef = useRef<CosmicEvent[]>([])
  const spaceActivitiesRef = useRef<SpaceActivity[]>([])
  const gravityPullActiveRef = useRef(false)
  const frameCountRef = useRef(0)
  const wormholesRef = useRef<GameObject[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [otherPlayers, setOtherPlayers] = useState<GameObject[]>([]);

  const [gameState, setGameState] = useState<"menu" | "playing" | "gameOver">("menu")
  const [score, setScore] = useState(0)
  const [displayStats, setDisplayStats] = useState({ mass: 0, energy: 0, maxEnergy: 0 })
  const [discoveredActivities, setDiscoveredActivities] = useState<string[]>([])

  // Calculate radius based on mass
  const calculateRadius = (mass: number, type: ObjectType) => {
    const baseRadius = Math.sqrt(mass) * 1.2

    switch (type) {
      case "player":
      case "ai":
        return Math.max(6, baseRadius)
      case "debris":
      case "asteroid":
        return Math.max(2, baseRadius * 0.8)
      case "planet":
        return Math.max(12, baseRadius * 1.1)
      case "star":
        return Math.max(18, baseRadius * 1.3)
      case "blackhole":
        return Math.max(20, baseRadius * 1.4)
      case "whitedwarf":
        return Math.max(10, baseRadius * 0.9)
      case "wormhole":
        return Math.max(12, baseRadius)
      case "pulsar":
        return Math.max(15, baseRadius * 1.1)
      case "neutronstar":
        return Math.max(8, baseRadius * 0.7)
      case "comet":
        return Math.max(4, baseRadius * 0.9)
      case "spacestation":
        return Math.max(8, baseRadius * 1.0)
      default:
        return baseRadius
    }
  }

  // Generate space activities
  const generateSpaceActivities = () => {
    if (!playerRef.current) return

    const player = playerRef.current
    const existingActivities = spaceActivitiesRef.current

    // Check if we need more activities
    const nearbyActivities = existingActivities.filter((activity) => {
      const dx = activity.x - player.x
      const dy = activity.y - player.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      return distance < 1200
    })

    if (nearbyActivities.length < 3) {
      for (let i = 0; i < 2; i++) {
        const angle = Math.random() * Math.PI * 2
        const distance = 500 + Math.random() * 700
        const x = player.x + Math.cos(angle) * distance
        const y = player.y + Math.sin(angle) * distance

        const activityTypes = [
          {
            type: "derelictShip" as const,
            color: "#666666",
            reward: 50,
            description: "Ancient derelict ship containing valuable resources",
          },
          {
            type: "ancientRelic" as const,
            color: "#gold",
            reward: 100,
            description: "Mysterious ancient artifact with unknown powers",
          },
          {
            type: "energyCrystal" as const,
            color: "#00ffff",
            reward: 75,
            description: "Pure energy crystal that restores full energy",
          },
          {
            type: "spaceWhale" as const,
            color: "#4444ff",
            reward: 150,
            description: "Majestic space creature - approach with caution",
          },
          {
            type: "alienStructure" as const,
            color: "#ff00ff",
            reward: 200,
            description: "Alien megastructure of unknown origin",
          },
        ]

        const activityType = activityTypes[Math.floor(Math.random() * activityTypes.length)]

        spaceActivitiesRef.current.push({
          id: `activity-${Date.now()}-${i}`,
          type: activityType.type,
          x,
          y,
          radius: 15 + Math.random() * 10,
          color: activityType.color,
          reward: activityType.reward,
          discovered: false,
          description: activityType.description,
        })
      }
    }
  }

  // Generate diverse objects with more small mass objects
  const generateObjectsAroundPlayer = () => {
    if (!playerRef.current) return

    const player = playerRef.current
    const existingObjects = gameObjectsRef.current

    const nearbyObjects = existingObjects.filter((obj) => {
      const dx = obj.x - player.x
      const dy = obj.y - player.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      return distance < 1000 && obj.type !== "player" && obj.type !== "ai"
    })

    if (nearbyObjects.length < 35) {
      // Generate more objects including many small mass objects
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2
        const distance = 300 + Math.random() * 700
        const x = player.x + Math.cos(angle) * distance
        const y = player.y + Math.sin(angle) * distance

        const rand = Math.random()
        let newObject: GameObject

        if (rand < 0.02) {
          // Black hole (landmark)
          const mass = 150 + Math.random() * 100
          newObject = {
            id: `blackhole-${Date.now()}-${i}`,
            x,
            y,
            vx: 0,
            vy: 0,
            mass,
            radius: calculateRadius(mass, "blackhole"),
            type: "blackhole",
            color: "#ff0066",
            isGlowing: true,
            chargingRate: 12,
            isLandmark: true,
          }
        } else if (rand < 0.04) {
          // Star (landmark)
          const mass = 100 + Math.random() * 80
          newObject = {
            id: `star-${Date.now()}-${i}`,
            x,
            y,
            vx: 0,
            vy: 0,
            mass,
            radius: calculateRadius(mass, "star"),
            type: "star",
            color: "#ffaa00",
            isGlowing: true,
            chargingRate: 8,
            isLandmark: true,
            pulsePhase: Math.random() * Math.PI * 2,
          }
        } else if (rand < 0.06) {
          // Pulsar (landmark)
          const mass = 80 + Math.random() * 60
          newObject = {
            id: `pulsar-${Date.now()}-${i}`,
            x,
            y,
            vx: 0,
            vy: 0,
            mass,
            radius: calculateRadius(mass, "pulsar"),
            type: "pulsar",
            color: "#00ffaa",
            isGlowing: true,
            chargingRate: 10,
            isLandmark: true,
            pulsePhase: Math.random() * Math.PI * 2,
          }
        } else if (rand < 0.08) {
          // White dwarf
          const mass = 30 + Math.random() * 25
          newObject = {
            id: `whitedwarf-${Date.now()}-${i}`,
            x,
            y,
            vx: 0,
            vy: 0,
            mass,
            radius: calculateRadius(mass, "whitedwarf"),
            type: "whitedwarf",
            color: "#ffffff",
            isGlowing: true,
            chargingRate: 9,
          }
        } else if (rand < 0.1) {
          // Wormhole
          const mass = 20
          const wormhole = {
            id: `wormhole-${Date.now()}-${i}`,
            x,
            y,
            vx: 0,
            vy: 0,
            mass,
            radius: calculateRadius(mass, "wormhole"),
            type: "wormhole" as ObjectType,
            color: "#9966ff",
            isGlowing: true,
            chargingRate: 6,
          }
          wormholesRef.current.push(wormhole)
          newObject = wormhole
        } else if (rand < 0.12) {
          // Space Station
          const mass = 15 + Math.random() * 10
          newObject = {
            id: `spacestation-${Date.now()}-${i}`,
            x,
            y,
            vx: 0,
            vy: 0,
            mass,
            radius: calculateRadius(mass, "spacestation"),
            type: "spacestation",
            color: "#cccccc",
            isGlowing: true,
            chargingRate: 5,
          }
        } else if (rand < 0.25) {
          // Planet
          const mass = 35 + Math.random() * 30
          newObject = {
            id: `planet-${Date.now()}-${i}`,
            x,
            y,
            vx: 0,
            vy: 0,
            mass,
            radius: calculateRadius(mass, "planet"),
            type: "planet",
            color: `hsl(${120 + Math.random() * 60}, 60%, 50%)`,
          }
        } else if (rand < 0.35) {
          // Comet
          const mass = 3 + Math.random() * 5
          newObject = {
            id: `comet-${Date.now()}-${i}`,
            x,
            y,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 3,
            mass,
            radius: calculateRadius(mass, "comet"),
            type: "comet",
            color: "#66ccff",
          }
        } else if (rand < 0.55) {
          // Asteroid (small mass)
          const mass = 2 + Math.random() * 4
          newObject = {
            id: `asteroid-${Date.now()}-${i}`,
            x,
            y,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            mass,
            radius: calculateRadius(mass, "asteroid"),
            type: "asteroid",
            color: "#996633",
          }
        } else {
          // Debris (very small mass - abundant)
          const mass = 0.5 + Math.random() * 2.5
          newObject = {
            id: `debris-${Date.now()}-${i}`,
            x,
            y,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            mass,
            radius: calculateRadius(mass, "debris"),
            type: "debris",
            color: "#888888",
          }
        }

        gameObjectsRef.current.push(newObject)
      }
    }
  }

  // Generate more AI players with better behavior
  const generateAIPlayers = () => {
    if (!playerRef.current) return

    const player = playerRef.current
    const existingAI = gameObjectsRef.current.filter((obj) => obj.type === "ai")

    if (existingAI.length < 8) {
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2
        const distance = 400 + Math.random() * 600
        const mass = 4 + Math.random() * 6

        gameObjectsRef.current.push({
          id: `ai-${Date.now()}-${i}`,
          x: player.x + Math.cos(angle) * distance,
          y: player.y + Math.sin(angle) * distance,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          mass,
          radius: calculateRadius(mass, "ai"),
          type: "ai",
          color: `hsl(${Math.random() * 360}, 70%, 60%)`,
          energy: 40 + Math.random() * 40,
          maxEnergy: 100,
          aiState: "exploring",
          lastMovementTime: Date.now(),
        })
      }
    }
  }

  // Initialize game
  const initGame = () => {
    cosmicEventsRef.current = []
    spaceActivitiesRef.current = []
    frameCountRef.current = 0
    wormholesRef.current = []
    setDiscoveredActivities([])

    const newPlayer: GameObject = {
      id: "player",
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      mass: PLAYER_START_MASS,
      radius: calculateRadius(PLAYER_START_MASS, "player"),
      type: "player",
      color: "#00ffff",
      energy: PLAYER_START_ENERGY,
      maxEnergy: PLAYER_MAX_ENERGY,
    }

    const objects: GameObject[] = [newPlayer]

    gameObjectsRef.current = objects
    playerRef.current = newPlayer
    cameraRef.current = { x: 0, y: 0 }
    setScore(0)
    setDisplayStats({ mass: newPlayer.mass, energy: newPlayer.energy!, maxEnergy: newPlayer.maxEnergy! })
    setGameState("playing")

    generateObjectsAroundPlayer()
    generateAIPlayers()
    generateSpaceActivities()
  }

  // Enhanced orbital mechanics for glowing objects
  const handleOrbitalMechanics = (obj: GameObject, objects: GameObject[]) => {
    if (obj.type === "player") {
      // Check if player is near glowing objects
      objects.forEach((glowingObj) => {
        if (!glowingObj.isGlowing || glowingObj.id === obj.id) return

        const dx = glowingObj.x - obj.x
        const dy = glowingObj.y - obj.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const minOrbitDistance = glowingObj.radius + obj.radius + 10

        if (distance < glowingObj.radius + obj.radius + 50) {
          // Close to glowing object - check if player is trying to move away
          const playerMoving =
            keysRef.current.has("arrowleft") ||
            keysRef.current.has("arrowright") ||
            keysRef.current.has("arrowup") ||
            keysRef.current.has("arrowdown") ||
            keysRef.current.has("a") ||
            keysRef.current.has("d") ||
            keysRef.current.has("w") ||
            keysRef.current.has("s")

          if (playerMoving) {
            // Player is actively moving - reduce absorption risk
            obj.absorptionProgress = Math.max(0, (obj.absorptionProgress || 0) - 0.01)
          } else {
            // Player is not moving - slowly increase absorption
            obj.absorptionProgress = (obj.absorptionProgress || 0) + ORBITAL_ABSORPTION_RATE

            if (obj.absorptionProgress! > 1) {
              // Absorbed after staying too long without moving
              obj.energy = 0
            }
          }

          // Create orbital motion when close
          if (distance > minOrbitDistance) {
            const orbitForce = 0.02
            const tangentX = -dy / distance
            const tangentY = dx / distance

            obj.vx += tangentX * orbitForce
            obj.vy += tangentY * orbitForce
          }
        } else {
          obj.absorptionProgress = 0
        }
      })
    }
  }

  // Enhanced AI behavior
  const updateAI = (ai: GameObject, objects: GameObject[]) => {
    if (!ai.energy) return

    const now = Date.now()
    if (now - (ai.lastMovementTime || 0) < 100) return // Limit AI update frequency

    ai.lastMovementTime = now

    // AI growth over time
    if (ai.mass < AI_MAX_MASS) {
      ai.mass += AI_GROWTH_RATE
      ai.radius = calculateRadius(ai.mass, ai.type)
    }

    // Find nearby objects
    const nearbyObjects = objects.filter((obj) => {
      if (obj.id === ai.id) return false
      const dx = obj.x - ai.x
      const dy = obj.y - ai.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      return distance < 300
    })

    // AI decision making
    const smallerObjects = nearbyObjects.filter((obj) => obj.mass < ai.mass && !obj.isGlowing)
    const largerObjects = nearbyObjects.filter((obj) => obj.mass > ai.mass)
    const glowingObjects = nearbyObjects.filter((obj) => obj.isGlowing)

    if (ai.energy < 30 && glowingObjects.length > 0) {
      // Need energy - go to nearest glowing object
      ai.aiState = "charging"
      const target = glowingObjects[0]
      const dx = target.x - ai.x
      const dy = target.y - ai.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > 0) {
        const force = 0.1
        ai.vx += (dx / distance) * force
        ai.vy += (dy / distance) * force
      }
    } else if (largerObjects.length > 0) {
      // Flee from larger objects
      ai.aiState = "fleeing"
      largerObjects.forEach((threat) => {
        const dx = ai.x - threat.x
        const dy = ai.y - threat.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance > 0 && distance < 150) {
          const force = 0.15
          ai.vx += (dx / distance) * force
          ai.vy += (dy / distance) * force
        }
      })
    } else if (smallerObjects.length > 0) {
      // Hunt smaller objects
      ai.aiState = "hunting"
      const target = smallerObjects[0]
      const dx = target.x - ai.x
      const dy = target.y - ai.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > 0) {
        const force = 0.08
        ai.vx += (dx / distance) * force
        ai.vy += (dy / distance) * force
      }
    } else {
      // Explore randomly
      ai.aiState = "exploring"
      if (Math.random() < 0.02) {
        ai.vx += (Math.random() - 0.5) * 0.2
        ai.vy += (Math.random() - 0.5) * 0.2
      }
    }
  }

  // Calculate gravity forces
  const calculateGravityForces = (targetObject: GameObject, objects: GameObject[]) => {
    const forces: GravityForce[] = []

    objects.forEach((obj) => {
      if (obj.id === targetObject.id) return

      const dx = obj.x - targetObject.x
      const dy = obj.y - targetObject.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > 0 && distance < 600) {
        const force = (GRAVITY_CONSTANT * obj.mass) / (distance * distance)
        const direction = Math.atan2(dy, dx)

        let color = "#00ff00"
        if (obj.type === "blackhole") color = "#ff0066"
        else if (obj.type === "star") color = "#ffaa00"
        else if (obj.type === "pulsar") color = "#00ffaa"
        else if (obj.type === "neutronstar") color = "#aaaaff"
        else if (obj.type === "whitedwarf") color = "#ffffff"
        else if (obj.type === "wormhole") color = "#9966ff"
        else if (obj.type === "spacestation") color = "#cccccc"
        else if (force > 2) color = "#0088ff"

        forces.push({
          direction,
          strength: Math.min(force, 15),
          source: obj,
          color,
        })
      }
    })

    return forces
  }

  // Apply gravity
  const applyGravity = (obj: GameObject, objects: GameObject[]) => {
    let fx = 0,
      fy = 0

    objects.forEach((other) => {
      if (other.id === obj.id) return

      const dx = other.x - obj.x
      const dy = other.y - obj.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > 0) {
        let force = (GRAVITY_CONSTANT * other.mass) / (distance * distance)

        if (other.isGlowing) {
          force *= 1.3
        }

        fx += (dx / distance) * force
        fy += (dy / distance) * force
      }
    })

    // Gravity pull ability
    if (gravityPullActiveRef.current && obj.id === "player" && playerRef.current?.energy! > 0) {
      const pullStrength = playerRef.current!.mass * GRAVITY_PULL_STRENGTH
      objects.forEach((other) => {
        if (other.id === obj.id || other.mass >= obj.mass) return

        const dx = obj.x - other.x
        const dy = obj.y - other.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance > 0 && distance < GRAVITY_PULL_RADIUS) {
          const pullForce = pullStrength / (distance * distance)
          other.vx += (dx / distance) * pullForce
          other.vy += (dy / distance) * pullForce
        }
      })

      playerRef.current!.energy! -= GRAVITY_PULL_COST * 0.016
    }

    obj.vx += fx
    obj.vy += fy

    const speed = Math.sqrt(obj.vx * obj.vx + obj.vy * obj.vy)
    if (speed > MAX_VELOCITY) {
      obj.vx = (obj.vx / speed) * MAX_VELOCITY
      obj.vy = (obj.vy / speed) * MAX_VELOCITY
    }
  }

  // Enhanced energy system
  const updateEnergy = (obj: GameObject, objects: GameObject[]) => {
    if (obj.energy === undefined || obj.maxEnergy === undefined) return

    obj.energy = Math.max(0, obj.energy - ENERGY_DECAY_RATE * 0.016)

    objects.forEach((other) => {
      if (!other.isGlowing || other.id === obj.id) return

      const dx = other.x - obj.x
      const dy = other.y - obj.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < CHARGING_RADIUS && distance > other.radius + obj.radius + 5) {
        const chargeRate = (other.chargingRate || 1) * (1 - distance / CHARGING_RADIUS)
        obj.energy = Math.min(obj.maxEnergy!, obj.energy + chargeRate * 0.016)
      }
    })
  }

  // Enhanced cosmic events
  const generateCosmicEvents = () => {
    if (Math.random() < 0.004) {
      const player = playerRef.current
      if (!player) return

      const eventTypes: CosmicEvent["type"][] = [
        "solarFlare",
        "meteorShower",
        "wormholeStorm",
        "solarWind",
        "coronalMassEjection",
        "magneticStorm",
        "nebula",
        "asteroidBelt",
        "quantumAnomaly",
      ]
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)]

      const angle = Math.random() * Math.PI * 2
      const distance = 300 + Math.random() * 500

      let rewards = 0
      if (eventType === "quantumAnomaly") rewards = 100
      if (eventType === "nebula") rewards = 50

      cosmicEventsRef.current.push({
        id: `event-${Date.now()}`,
        type: eventType,
        x: player.x + Math.cos(angle) * distance,
        y: player.y + Math.sin(angle) * distance,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        duration: 8 + Math.random() * 8,
        timeLeft: 8 + Math.random() * 8,
        radius: 80 + Math.random() * 100,
        direction: angle,
        intensity: 0.5 + Math.random() * 0.5,
        rewards,
      })
    }
  }

  // Update cosmic events
  const updateCosmicEvents = () => {
    cosmicEventsRef.current = cosmicEventsRef.current.filter((event) => {
      event.timeLeft -= 0.016

      if (event.type === "meteorShower" && event.timeLeft > 0) {
        if (Math.random() < 0.15) {
          const mass = 1.5 + Math.random() * 2.5
          gameObjectsRef.current.push({
            id: `meteor-${Date.now()}-${Math.random()}`,
            x: event.x + (Math.random() - 0.5) * event.radius,
            y: event.y + (Math.random() - 0.5) * event.radius,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            mass,
            radius: calculateRadius(mass, "debris"),
            type: "debris",
            color: "#ffcc66",
          })
        }
      }

      if (event.type === "asteroidBelt" && event.timeLeft > 0) {
        if (Math.random() < 0.1) {
          const mass = 2 + Math.random() * 4
          gameObjectsRef.current.push({
            id: `asteroid-${Date.now()}-${Math.random()}`,
            x: event.x + (Math.random() - 0.5) * event.radius,
            y: event.y + (Math.random() - 0.5) * event.radius,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 3,
            mass,
            radius: calculateRadius(mass, "asteroid"),
            type: "asteroid",
            color: "#996633",
          })
        }
      }

      return event.timeLeft > 0
    })
  }

  // Handle space activity interactions
  const handleSpaceActivities = () => {
    if (!playerRef.current) return

    const player = playerRef.current

    spaceActivitiesRef.current.forEach((activity) => {
      const dx = activity.x - player.x
      const dy = activity.y - player.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < activity.radius + player.radius && !activity.discovered) {
        activity.discovered = true
        setScore((prev) => prev + activity.reward)

        if (activity.type === "energyCrystal") {
          player.energy = player.maxEnergy!
        }

        setDiscoveredActivities((prev) => [...prev, activity.id])
      }
    })
  }

  // Enhanced collision handling
  const handleCollisions = (objects: GameObject[]) => {
    const toRemove: string[] = []
    let scoreIncrease = 0

    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        const obj1 = objects[i]
        const obj2 = objects[j]

        const dx = obj2.x - obj1.x
        const dy = obj2.y - obj1.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < obj1.radius + obj2.radius) {
          // Wormhole teleportation
          if (obj1.type === "wormhole" && obj2.type === "player") {
            const availableWormholes = wormholesRef.current.filter((w) => w.id !== obj1.id)
            if (availableWormholes.length > 0) {
              const targetWormhole = availableWormholes[Math.floor(Math.random() * availableWormholes.length)]
              obj2.x = targetWormhole.x + (Math.random() - 0.5) * 100
              obj2.y = targetWormhole.y + (Math.random() - 0.5) * 100
              obj2.vx *= 0.5
              obj2.vy *= 0.5
            }
            continue
          }

          // Fatal collision with glowing bodies (except when orbiting safely)
          if (obj1.isGlowing && obj2.type === "player" && (obj2.absorptionProgress || 0) > 1) {
            obj2.energy = 0
            continue
          }
          if (obj2.isGlowing && obj1.type === "player" && (obj1.absorptionProgress || 0) > 1) {
            obj1.energy = 0
            continue
          }

          // Regular absorption - larger always absorbs smaller
          const larger = obj1.mass > obj2.mass ? obj1 : obj2
          const smaller = obj1.mass > obj2.mass ? obj2 : obj1

          // Prevent absorbing glowing objects
          if (!smaller.isGlowing && !larger.isGlowing) {
            larger.mass += smaller.mass * MASS_ABSORPTION_RATE
            larger.radius = calculateRadius(larger.mass, larger.type)

            if (larger.energy && smaller.energy) {
              larger.energy = Math.min(larger.maxEnergy!, larger.energy + smaller.energy * ENERGY_ABSORPTION_RATE)
            }

            if (larger.id === "player") {
              scoreIncrease += Math.floor(smaller.mass * 20)
            }

            toRemove.push(smaller.id)
          }
        }
      }
    }

    return { toRemove, scoreIncrease }
  }

  // Enhanced render function
  const render = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const objects = gameObjectsRef.current
    const camera = cameraRef.current

    // Clear canvas
    ctx.fillStyle = "#000011"
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Enhanced starfield
    ctx.fillStyle = "#ffffff"
    for (let i = 0; i < 300; i++) {
      const x = (i * 123 + camera.x * 0.03) % CANVAS_WIDTH
      const y = (i * 456 + camera.y * 0.03) % CANVAS_HEIGHT
      if (x >= 0 && y >= 0) {
        ctx.fillRect(x, y, 1, 1)
      }
    }

    // Draw space activities
    spaceActivitiesRef.current.forEach((activity) => {
      const screenX = activity.x - camera.x
      const screenY = activity.y - camera.y

      if (screenX < -100 || screenX > CANVAS_WIDTH + 100 || screenY < -100 || screenY > CANVAS_HEIGHT + 100) return

      ctx.save()

      if (!activity.discovered) {
        ctx.shadowColor = activity.color
        ctx.shadowBlur = 15
        const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7
        ctx.globalAlpha = pulse
      } else {
        ctx.globalAlpha = 0.3
      }

      ctx.fillStyle = activity.color
      ctx.beginPath()
      ctx.arc(screenX, screenY, activity.radius, 0, Math.PI * 2)
      ctx.fill()

      // Activity type indicator
      ctx.globalAlpha = 1
      ctx.fillStyle = "#ffffff"
      ctx.font = "12px Arial"
      ctx.textAlign = "center"
      let symbol = "?"
      if (activity.type === "derelictShip") symbol = "🚀"
      if (activity.type === "ancientRelic") symbol = "⚱️"
      if (activity.type === "energyCrystal") symbol = "💎"
      if (activity.type === "spaceWhale") symbol = "🐋"
      if (activity.type === "alienStructure") symbol = "🛸"

      ctx.fillText(symbol, screenX, screenY + 4)

      ctx.restore()
    })

    // Draw cosmic events
    cosmicEventsRef.current.forEach((event) => {
      const screenX = event.x - camera.x
      const screenY = event.y - camera.y

      ctx.save()
      ctx.globalAlpha = event.timeLeft / event.duration

      if (event.type === "nebula") {
        ctx.fillStyle = "#663399"
        ctx.beginPath()
        ctx.arc(screenX, screenY, event.radius, 0, Math.PI * 2)
        ctx.fill()
      } else if (event.type === "asteroidBelt") {
        ctx.strokeStyle = "#996633"
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(screenX, screenY, event.radius * 0.8, 0, Math.PI * 2)
        ctx.stroke()
      } else if (event.type === "quantumAnomaly") {
        ctx.strokeStyle = "#ff00ff"
        ctx.lineWidth = 3
        for (let i = 0; i < 6; i++) {
          ctx.beginPath()
          ctx.arc(screenX, screenY, event.radius * 0.2 + i * 12, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
      // ... other event types

      ctx.restore()
    })

    // Draw charging radius for player
    if (playerRef.current) {
      const player = playerRef.current
      const screenX = player.x - camera.x
      const screenY = player.y - camera.y

      ctx.save()
      ctx.globalAlpha = 0.1
      ctx.strokeStyle = "#00ffff"
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])
      ctx.beginPath()
      ctx.arc(screenX, screenY, CHARGING_RADIUS, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Draw other players
    otherPlayers.forEach((player) => {
      const screenX = player.x - camera.x;
      const screenY = player.y - camera.y;

      if (screenX < -100 || screenX > CANVAS_WIDTH + 100 || screenY < -100 || screenY > CANVAS_HEIGHT + 100) return;

      ctx.save();
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(screenX, screenY, player.radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw player name
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`Player ${player.id.slice(-4)}`, screenX, screenY - player.radius - 10);

      ctx.restore();
    });

    // Draw objects
    objects.forEach((obj) => {
      const screenX = obj.x - camera.x
      const screenY = obj.y - camera.y

      if (screenX < -100 || screenX > CANVAS_WIDTH + 100 || screenY < -100 || screenY > CANVAS_HEIGHT + 100) return

      ctx.save()

      // Glow effects
      if (obj.isGlowing) {
        ctx.shadowColor = obj.color
        ctx.shadowBlur = obj.radius * 2

        let pulse = 1
        if (obj.type === "pulsar") {
          pulse = Math.sin((Date.now() + (obj.pulsePhase || 0)) * 0.01) * 0.4 + 0.6
        } else {
          pulse = Math.sin(Date.now() * 0.003) * 0.2 + 0.8
        }
        ctx.globalAlpha = pulse
      }

      // Draw object
      ctx.fillStyle = obj.color
      ctx.beginPath()
      ctx.arc(screenX, screenY, obj.radius, 0, Math.PI * 2)
      ctx.fill()

      // Energy bars
      if (obj.energy !== undefined) {
        const barWidth = obj.radius * 2.5
        const barHeight = 6
        const energyPercent = obj.energy / obj.maxEnergy!

        ctx.globalAlpha = 1
        ctx.fillStyle = "#333"
        ctx.fillRect(screenX - barWidth / 2, screenY - obj.radius - 15, barWidth, barHeight)

        ctx.fillStyle = energyPercent > 0.5 ? "#00ffff" : energyPercent > 0.25 ? "#ffff00" : "#ff0000"
        ctx.fillRect(screenX - barWidth / 2, screenY - obj.radius - 15, barWidth * energyPercent, barHeight)
      }

      // Absorption progress indicator for player
      if (obj.type === "player" && (obj.absorptionProgress || 0) > 0) {
        const progressWidth = obj.radius * 3
        const progressHeight = 4
        const progress = obj.absorptionProgress || 0

        ctx.globalAlpha = 1
        ctx.fillStyle = "#ff0000"
        ctx.fillRect(screenX - progressWidth / 2, screenY + obj.radius + 10, progressWidth * progress, progressHeight)

        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 1
        ctx.strokeRect(screenX - progressWidth / 2, screenY + obj.radius + 10, progressWidth, progressHeight)
      }

      // AI state indicator
      if (obj.type === "ai" && obj.aiState) {
        ctx.globalAlpha = 0.7
        ctx.fillStyle = "#ffffff"
        ctx.font = "8px Arial"
        ctx.textAlign = "center"
        let stateSymbol = "?"
        if (obj.aiState === "hunting") stateSymbol = "🎯"
        if (obj.aiState === "fleeing") stateSymbol = "💨"
        if (obj.aiState === "charging") stateSymbol = "⚡"
        if (obj.aiState === "exploring") stateSymbol = "🔍"

        ctx.fillText(stateSymbol, screenX, screenY - obj.radius - 20)
      }

      // Special effects
      if (obj.type === "comet") {
        ctx.globalAlpha = 0.6
        ctx.strokeStyle = obj.color
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(screenX, screenY)
        ctx.lineTo(screenX - obj.vx * 15, screenY - obj.vy * 15)
        ctx.stroke()
      }

      ctx.restore()
    })

    // Enhanced gravity pull effect
    if (gravityPullActiveRef.current && playerRef.current) {
      const player = playerRef.current
      const screenX = player.x - camera.x
      const screenY = player.y - camera.y

      ctx.save()
      ctx.globalAlpha = 0.4
      ctx.strokeStyle = "#00ffff"
      ctx.lineWidth = 3
      ctx.setLineDash([8, 8])
      ctx.beginPath()
      ctx.arc(screenX, screenY, GRAVITY_PULL_RADIUS, 0, Math.PI * 2)
      ctx.stroke()

      ctx.globalAlpha = 0.15
      ctx.fillStyle = "#00ffff"
      ctx.beginPath()
      ctx.arc(screenX, screenY, GRAVITY_PULL_RADIUS, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  // Enhanced gravity compass
  const GravityCompass = () => {
    const forces = gravityForcesRef.current
    const landmarks = gameObjectsRef.current.filter((obj) => obj.isLandmark)

    return (
      <div
        className="absolute pointer-events-none"
        style={{
          right: 20,
          bottom: 20,
          width: COMPASS_SIZE,
          height: COMPASS_SIZE,
        }}
      >
        <svg width={COMPASS_SIZE} height={COMPASS_SIZE}>
          <circle
            cx={COMPASS_SIZE / 2}
            cy={COMPASS_SIZE / 2}
            r={COMPASS_SIZE / 2 - 5}
            fill="rgba(0,0,0,0.9)"
            stroke="#333"
            strokeWidth="2"
          />

          {/* Gravity forces */}
          {forces.slice(0, 8).map((force, index) => {
            const armLength = Math.min(force.strength * 6, COMPASS_SIZE / 2 - 8)
            const angle = force.direction
            const endX = COMPASS_SIZE / 2 + Math.cos(angle) * armLength
            const endY = COMPASS_SIZE / 2 + Math.sin(angle) * armLength

            return (
              <g key={index}>
                <line
                  x1={COMPASS_SIZE / 2}
                  y1={COMPASS_SIZE / 2}
                  x2={endX}
                  y2={endY}
                  stroke={force.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx={endX} cy={endY} r="3" fill={force.color} />
              </g>
            )
          })}

          {/* Landmark indicators */}
          {landmarks.slice(0, 6).map((landmark, index) => {
            if (!playerRef.current) return null

            const dx = landmark.x - playerRef.current.x
            const dy = landmark.y - playerRef.current.y
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance > 1200) return null

            const angle = Math.atan2(dy, dx)
            const radius = COMPASS_SIZE / 2 - 15
            const x = COMPASS_SIZE / 2 + Math.cos(angle) * radius
            const y = COMPASS_SIZE / 2 + Math.sin(angle) * radius

            return (
              <circle
                key={`landmark-${index}`}
                cx={x}
                cy={y}
                r="4"
                fill={landmark.color}
                stroke="#fff"
                strokeWidth="1"
                opacity="0.8"
              />
            )
          })}

          <circle cx={COMPASS_SIZE / 2} cy={COMPASS_SIZE / 2} r="4" fill="#ffffff" />
        </svg>
      </div>
    )
  }

  // Enhanced minimap (only one)
  const Minimap = () => {
    const landmarks = gameObjectsRef.current.filter((obj) => obj.isLandmark)
    const activities = spaceActivitiesRef.current.filter((a) => !a.discovered)

    return (
      <div className="absolute top-4 right-4">
        <div className="w-40 h-40 bg-black bg-opacity-95 border border-gray-500 rounded">
          <svg width="160" height="160" className="overflow-hidden">
            {/* Player */}
            <circle cx="80" cy="80" r="3" fill="#00ffff" />

            {/* Landmarks */}
            {landmarks.slice(0, 15).map((obj, i) => {
              const player = playerRef.current
              if (!player) return null

              const relX = (obj.x - player.x) * 0.04 + 80
              const relY = (obj.y - player.y) * 0.04 + 80

              if (relX < 0 || relX > 160 || relY < 0 || relY > 160) return null

              return <circle key={i} cx={relX} cy={relY} r="2" fill={obj.color} opacity="0.9" />
            })}

            {/* Space activities */}
            {activities.map((activity, i) => {
              const player = playerRef.current
              if (!player) return null

              const relX = (activity.x - player.x) * 0.04 + 80
              const relY = (activity.y - player.y) * 0.04 + 80

              if (relX < 0 || relX > 160 || relY < 0 || relY > 160) return null

              return <circle key={`activity-${i}`} cx={relX} cy={relY} r="2" fill={activity.color} opacity="0.8" />
            })}

            {/* Cosmic events */}
            {cosmicEventsRef.current.map((event, i) => {
              const player = playerRef.current
              if (!player) return null

              const relX = (event.x - player.x) * 0.04 + 80
              const relY = (event.y - player.y) * 0.04 + 80

              if (relX < 0 || relX > 160 || relY < 0 || relY > 160) return null

              return <circle key={`event-${i}`} cx={relX} cy={relY} r="1" fill="#ff6600" opacity="0.7" />
            })}
          </svg>
        </div>
      </div>
    )
  }

  // Event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase())
      if (e.code === "Space") {
        e.preventDefault()
        gravityPullActiveRef.current = true
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase())
      if (e.code === "Space") {
        e.preventDefault()
        gravityPullActiveRef.current = false
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  // Add mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Handle mobile movement
  const handleMobileMove = (direction: { x: number; y: number }) => {
    if (!playerRef.current || gameState !== 'playing' || isPaused) return
    const acceleration = 0.15
    playerRef.current.vx += direction.x * acceleration
    playerRef.current.vy += direction.y * acceleration
  }

  // Handle mobile gravity pull
  const handleMobileGravityPull = (active: boolean) => {
    gravityPullActiveRef.current = active;
    if (active) {
      sendPlayerAction({
        type: 'gravityPull',
        active: true
      });
    }
  }

  // WebSocket connection setup
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to game server');
        setIsConnected(true);
      };

      ws.onclose = () => {
        console.log('Disconnected from game server');
        setIsConnected(false);
        // Attempt to reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleServerMessage(data);
        } catch (error) {
          console.error('Error handling server message:', error);
        }
      };

      return () => {
        ws.close();
      };
    };

    connectWebSocket();
  }, []);

  // Handle server messages
  const handleServerMessage = (data: any) => {
    switch (data.type) {
      case 'init':
        // Initialize game with server state
        if (data.gameState) {
          const { players, objects } = data.gameState;
          setOtherPlayers(players.filter((p: GameObject) => p.id !== data.playerId));
          gameObjectsRef.current = objects;
        }
        break;

      case 'gameState':
        // Update game state from server
        if (data.state) {
          const { players, objects } = data.state;
          setOtherPlayers(players.filter((p: GameObject) => p.id !== playerRef.current?.id));
          gameObjectsRef.current = objects;
        }
        break;

      case 'playerJoined':
        // Handle new player joining
        if (data.player) {
          setOtherPlayers(prev => [...prev, data.player]);
        }
        break;

      case 'playerLeft':
        // Handle player leaving
        if (data.playerId) {
          setOtherPlayers(prev => prev.filter(p => p.id !== data.playerId));
        }
        break;
    }
  };

  // Send player updates to server
  const sendPlayerUpdate = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN && playerRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'update',
        state: playerRef.current
      }));
    }
  };

  // Send player actions to server
  const sendPlayerAction = (action: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'action',
        action
      }));
    }
  };

  // Main game loop
  const gameLoop = () => {
    frameCountRef.current++
    const objects = gameObjectsRef.current
    const currentPlayer = objects.find((obj) => obj.id === "player")

    if (!currentPlayer || currentPlayer.energy! <= 0) {
      setGameState("gameOver")
      return
    }

    // Player input
    const acceleration = 0.15
    if (keysRef.current.has("arrowleft") || keysRef.current.has("a")) {
      currentPlayer.vx -= acceleration
    }
    if (keysRef.current.has("arrowright") || keysRef.current.has("d")) {
      currentPlayer.vx += acceleration
    }
    if (keysRef.current.has("arrowup") || keysRef.current.has("w")) {
      currentPlayer.vy -= acceleration
    }
    if (keysRef.current.has("arrowdown") || keysRef.current.has("s")) {
      currentPlayer.vy += acceleration
    }

    // Generate content periodically
    if (frameCountRef.current % 240 === 0) {
      generateObjectsAroundPlayer()
    }
    if (frameCountRef.current % 300 === 0) {
      generateAIPlayers()
    }
    if (frameCountRef.current % 600 === 0) {
      generateSpaceActivities()
    }

    // Physics and AI
    objects.forEach((obj) => {
      if (obj.type === "ai") {
        updateAI(obj, objects)
      }

      if (!obj.isGlowing || obj.type === "wormhole") {
        applyGravity(obj, objects)
      }

      handleOrbitalMechanics(obj, objects)
      updateEnergy(obj, objects)

      obj.x += obj.vx
      obj.y += obj.vy

      obj.vx *= 0.998
      obj.vy *= 0.998
    })

    // Events and activities
    generateCosmicEvents()
    updateCosmicEvents()
    handleSpaceActivities()

    // Collisions
    const { toRemove, scoreIncrease } = handleCollisions(objects)
    gameObjectsRef.current = objects.filter((obj) => !toRemove.includes(obj.id))

    wormholesRef.current = wormholesRef.current.filter((w) => !toRemove.includes(w.id))

    if (scoreIncrease > 0) {
      setScore((prev) => prev + scoreIncrease)
    }

    // Camera
    cameraRef.current.x = currentPlayer.x - CANVAS_WIDTH / 2
    cameraRef.current.y = currentPlayer.y - CANVAS_HEIGHT / 2

    // Update compass
    gravityForcesRef.current = calculateGravityForces(currentPlayer, gameObjectsRef.current)

    playerRef.current = currentPlayer

    // Update UI
    if (frameCountRef.current % 15 === 0) {
      setDisplayStats({
        mass: currentPlayer.mass,
        energy: currentPlayer.energy!,
        maxEnergy: currentPlayer.maxEnergy!,
      })
    }

    // Send player updates to server
    if (frameCountRef.current % 2 === 0) { // Send updates every 2 frames
      sendPlayerUpdate();
    }

    render()
    animationRef.current = requestAnimationFrame(gameLoop)
  }

  // Handle pause
  const handlePause = () => {
    setIsPaused(!isPaused)
    if (isPaused) {
      animationRef.current = requestAnimationFrame(gameLoop)
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
  }

  // Main game loop effect
  useEffect(() => {
    if (gameState !== "playing" || isPaused) return

    animationRef.current = requestAnimationFrame(gameLoop)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [gameState, isPaused])

  return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
      {gameState === "menu" && (
        <Card className="p-8 text-center bg-gray-900 border-cyan-500 max-w-md mx-4">
          <div className="space-y-6">
            <h1 className="text-4xl font-bold text-cyan-400 mb-4 animate-pulse">GRAVITY WARS.IO</h1>
            <div className="space-y-4">
              <p className="text-gray-300">
                Explore the infinite cosmos! Orbit glowing bodies to charge energy safely.
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                <div className="p-3 bg-gray-800 rounded-lg">
                  <span className="text-cyan-400">🎯</span> Hunt smaller objects
                </div>
                <div className="p-3 bg-gray-800 rounded-lg">
                  <span className="text-cyan-400">⚡</span> Collect energy
                </div>
                <div className="p-3 bg-gray-800 rounded-lg">
                  <span className="text-cyan-400">🚀</span> Discover mysteries
                </div>
                <div className="p-3 bg-gray-800 rounded-lg">
                  <span className="text-cyan-400">⚠️</span> Avoid absorption
                </div>
              </div>
            </div>
            <Button 
              onClick={initGame} 
              className="bg-cyan-600 hover:bg-cyan-700 w-full py-6 text-lg font-bold"
            >
              ENTER THE COSMOS
            </Button>
          </div>
        </Card>
      )}

      {gameState === "gameOver" && (
        <Card className="p-8 text-center bg-gray-900 border-red-500 max-w-md mx-4">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-red-400 mb-4">COSMIC DEMISE</h2>
            <div className="space-y-4">
              <p className="text-gray-300">Final Score: {score}</p>
              <p className="text-gray-400">Activities Discovered: {discoveredActivities.length}</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-800 rounded-lg">
                  <span className="text-red-400">🎯</span> Objects Absorbed
                </div>
                <div className="p-3 bg-gray-800 rounded-lg">
                  <span className="text-red-400">⚡</span> Energy Collected
                </div>
              </div>
            </div>
            <Button 
              onClick={initGame} 
              className="bg-red-600 hover:bg-red-700 w-full py-6 text-lg font-bold"
            >
              RESPAWN
            </Button>
          </div>
        </Card>
      )}

      {gameState === "playing" && (
        <>
          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="border border-gray-700" />

          {/* Status Panel - Compact on Mobile */}
          <div className={`absolute ${isMobile ? 'top-2 left-2' : 'top-4 left-4'} text-white`}>
            <div className={`bg-black bg-opacity-95 rounded-lg border border-cyan-500 ${isMobile ? 'p-2 text-xs' : 'p-4'}`}>
              <div className="flex justify-between items-center">
                <div className="text-cyan-400 font-bold">STATUS</div>
                <div className="flex items-center gap-2">
                  <span>⚡</span>
                  <div className="w-16 h-2 bg-gray-700 rounded">
                    <div
                      className="h-full bg-cyan-400 rounded transition-all"
                      style={{ width: `${(displayStats.energy / displayStats.maxEnergy) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className={`grid ${isMobile ? 'grid-cols-3 gap-1' : 'grid-cols-2 gap-2'} mt-1`}>
                <div>🎯 {score}</div>
                <div>⚖️ {displayStats.mass.toFixed(1)}</div>
                <div>📏 {playerRef.current?.radius.toFixed(1)}</div>
                <div>🔍 {discoveredActivities.length}</div>
              </div>
              {playerRef.current?.absorptionProgress && playerRef.current.absorptionProgress > 0 && (
                <div className="text-red-400 text-xs mt-1">⚠️ Absorption Risk!</div>
              )}
            </div>
          </div>

          {/* Pause Overlay */}
          {isPaused && (
            <PauseMenu 
              onResume={handlePause}
              onRespawn={initGame}
              stats={{
                score,
                mass: displayStats.mass,
                energy: displayStats.energy,
                discoveries: discoveredActivities.length
              }}
            />
          )}

          {/* Controls Panel - Desktop Only */}
          {!isMobile && (
            <div className="fixed bottom-4 left-4 text-white text-sm z-[80]">
              <div className="bg-black bg-opacity-95 p-3 rounded-lg border border-cyan-500">
                <div className="text-cyan-400 font-bold mb-2">ORBITAL MECHANICS</div>
                <div>W A S D / Arrow Keys: Move</div>
                <div>SPACE: Enhanced Gravity Pull</div>
                <div className="text-green-400 mt-2">🔄 Orbit glowing bodies safely</div>
                <div className="text-orange-400">🎯 Discover space activities</div>
                <div className="text-red-400">⚠️ Keep moving to avoid absorption</div>
              </div>
            </div>
          )}

          {/* Space Activities Panel - Compact on Mobile */}
          {spaceActivitiesRef.current.filter((a) => !a.discovered).length > 0 && (
            <div className={`absolute ${isMobile ? 'top-2 right-2' : 'top-4 left-1/2 transform -translate-x-1/2'} text-white`}>
              <div className={`bg-black bg-opacity-95 rounded-lg border border-purple-500 ${isMobile ? 'p-2 text-xs' : 'p-3'}`}>
                <div className="text-purple-400 font-bold">NEARBY</div>
                {spaceActivitiesRef.current
                  .filter((a) => !a.discovered)
                  .slice(0, isMobile ? 2 : 3)
                  .map((activity) => (
                    <div key={activity.id} className="text-sm">
                      {activity.type === "derelictShip" && "🚀 Ship"}
                      {activity.type === "ancientRelic" && "⚱️ Relic"}
                      {activity.type === "energyCrystal" && "💎 Crystal"}
                      {activity.type === "spaceWhale" && "🐋 Whale"}
                      {activity.type === "alienStructure" && "🛸 Structure"}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Cosmic Events Panel - Compact on Mobile */}
          {cosmicEventsRef.current.length > 0 && (
            <div className={`absolute ${isMobile ? 'top-2 left-1/2 transform -translate-x-1/2 mt-16' : 'top-4 right-4 mr-44'} text-white`}>
              <div className={`bg-black bg-opacity-95 rounded-lg border border-orange-500 ${isMobile ? 'p-2 text-xs' : 'p-3'}`}>
                <div className="text-orange-400 font-bold">EVENTS</div>
                {cosmicEventsRef.current.slice(0, isMobile ? 2 : undefined).map((event) => (
                  <div key={event.id} className="text-sm">
                    {event.type === "solarFlare" && "🌟 Flare"}
                    {event.type === "meteorShower" && "☄️ Meteor"}
                    {event.type === "nebula" && "🌌 Nebula"}
                    {event.type === "asteroidBelt" && "🪨 Belt"}
                    {event.type === "quantumAnomaly" && "⚛️ Anomaly"}
                    {event.type === "wormholeStorm" && "🌀 Storm"}
                    {event.type === "solarWind" && "💨 Wind"}
                    {event.type === "coronalMassEjection" && "🔥 CME"}
                    {event.type === "magneticStorm" && "⚡ Storm"}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Minimap - Compact on Mobile */}
          <div className={`absolute ${isMobile ? 'top-2 right-2 mt-32' : 'top-4 right-4'}`}>
            <div className={`bg-black bg-opacity-95 border border-gray-500 rounded ${isMobile ? 'w-20 h-20' : 'w-40 h-40'}`}>
              <svg width={isMobile ? 80 : 160} height={isMobile ? 80 : 160} className="overflow-hidden">
                {/* Player */}
                <circle cx="80" cy="80" r="3" fill="#00ffff" />

                {/* Landmarks */}
                {gameObjectsRef.current
                  .filter(obj => obj.isLandmark)
                  .slice(0, 15)
                  .map((obj, i) => {
                    const player = playerRef.current
                    if (!player) return null

                    const relX = (obj.x - player.x) * 0.04 + 80
                    const relY = (obj.y - player.y) * 0.04 + 80

                    if (relX < 0 || relX > 160 || relY < 0 || relY > 160) return null

                    return <circle key={i} cx={relX} cy={relY} r="2" fill={obj.color} opacity="0.9" />
                  })}

                {/* Space activities */}
                {spaceActivitiesRef.current
                  .filter(a => !a.discovered)
                  .map((activity, i) => {
                    const player = playerRef.current
                    if (!player) return null

                    const relX = (activity.x - player.x) * 0.04 + 80
                    const relY = (activity.y - player.y) * 0.04 + 80

                    if (relX < 0 || relX > 160 || relY < 0 || relY > 160) return null

                    return <circle key={`activity-${i}`} cx={relX} cy={relY} r="2" fill={activity.color} opacity="0.8" />
                  })}

                {/* Cosmic events */}
                {cosmicEventsRef.current.map((event, i) => {
                  const player = playerRef.current
                  if (!player) return null

                  const relX = (event.x - player.x) * 0.04 + 80
                  const relY = (event.y - player.y) * 0.04 + 80

                  if (relX < 0 || relX > 160 || relY < 0 || relY > 160) return null

                  return <circle key={`event-${i}`} cx={relX} cy={relY} r="1" fill="#ff6600" opacity="0.7" />
                })}
              </svg>
            </div>
          </div>

          {/* Gravity Compass - Compact on Mobile */}
          <div
            className="absolute pointer-events-none"
            style={{
              right: isMobile ? 8 : 20,
              bottom: isMobile ? 180 : 20,
              width: isMobile ? 80 : COMPASS_SIZE,
              height: isMobile ? 80 : COMPASS_SIZE,
            }}
          >
            <svg width={isMobile ? 80 : COMPASS_SIZE} height={isMobile ? 80 : COMPASS_SIZE}>
              {/* Gravity forces */}
              {gravityForcesRef.current.slice(0, 8).map((force, index) => {
                const armLength = Math.min(force.strength * 6, COMPASS_SIZE / 2 - 8)
                const angle = force.direction
                const endX = COMPASS_SIZE / 2 + Math.cos(angle) * armLength
                const endY = COMPASS_SIZE / 2 + Math.sin(angle) * armLength

                return (
                  <g key={index}>
                    <line
                      x1={COMPASS_SIZE / 2}
                      y1={COMPASS_SIZE / 2}
                      x2={endX}
                      y2={endY}
                      stroke={force.color}
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <circle cx={endX} cy={endY} r="3" fill={force.color} />
                  </g>
                )
              })}

              {/* Landmark indicators */}
              {gameObjectsRef.current
                .filter(obj => obj.isLandmark)
                .slice(0, 6)
                .map((landmark, index) => {
                  if (!playerRef.current) return null

                  const dx = landmark.x - playerRef.current.x
                  const dy = landmark.y - playerRef.current.y
                  const distance = Math.sqrt(dx * dx + dy * dy)

                  if (distance > 1200) return null

                  const angle = Math.atan2(dy, dx)
                  const radius = COMPASS_SIZE / 2 - 15
                  const x = COMPASS_SIZE / 2 + Math.cos(angle) * radius
                  const y = COMPASS_SIZE / 2 + Math.sin(angle) * radius

                  return (
                    <circle
                      key={`landmark-${index}`}
                      cx={x}
                      cy={y}
                      r="4"
                      fill={landmark.color}
                      stroke="#fff"
                      strokeWidth="1"
                      opacity="0.8"
                    />
                  )
                })}

              <circle cx={COMPASS_SIZE / 2} cy={COMPASS_SIZE / 2} r="4" fill="#ffffff" />
            </svg>
          </div>

          {/* Mobile Controls */}
          {isMobile && (
            <div className="fixed bottom-0 left-0 right-0 p-4 flex justify-between items-end pointer-events-none">
              <MobileControls
                onMove={handleMobileMove}
                onGravityPull={handleMobileGravityPull}
                onPause={handlePause}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
