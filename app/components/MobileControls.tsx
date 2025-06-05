import { useEffect, useRef } from 'react'

interface MobileControlsProps {
  onMove: (direction: { x: number; y: number }) => void
  onGravityPull: (active: boolean) => void
  onPause: () => void
}

export default function MobileControls({ onMove, onGravityPull, onPause }: MobileControlsProps) {
  const activeDirections = useRef<Set<string>>(new Set())

  const handleDirectionStart = (direction: string) => {
    activeDirections.current.add(direction)
    updateMovement()
  }

  const handleDirectionEnd = (direction: string) => {
    activeDirections.current.delete(direction)
    updateMovement()
  }

  const updateMovement = () => {
    let x = 0
    let y = 0

    if (activeDirections.current.has('left')) x -= 1
    if (activeDirections.current.has('right')) x += 1
    if (activeDirections.current.has('up')) y -= 1
    if (activeDirections.current.has('down')) y += 1

    // Normalize diagonal movement
    if (x !== 0 && y !== 0) {
      x *= 0.707 // 1/sqrt(2)
      y *= 0.707
    }

    onMove({ x, y })
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 flex justify-between items-end pointer-events-none">
      {/* Directional Buttons */}
      <div className="relative w-40 h-40 pointer-events-auto">
        <div className="absolute bottom-0 left-0 grid grid-cols-3 gap-1">
          {/* Top Row */}
          <button
            onTouchStart={() => {
              handleDirectionStart('left')
              handleDirectionStart('up')
            }}
            onTouchEnd={() => {
              handleDirectionEnd('left')
              handleDirectionEnd('up')
            }}
            className="w-10 h-10 bg-black bg-opacity-50 rounded-tl-lg border-2 border-cyan-500 flex items-center justify-center"
          >
            <div className="w-0 h-0 border-l-4 border-b-4 border-transparent border-l-cyan-500 border-b-cyan-500" />
          </button>
          <button
            onTouchStart={() => handleDirectionStart('up')}
            onTouchEnd={() => handleDirectionEnd('up')}
            className="w-10 h-10 bg-black bg-opacity-50 rounded-t-lg border-2 border-cyan-500 flex items-center justify-center"
          >
            <div className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-cyan-500" />
          </button>
          <button
            onTouchStart={() => {
              handleDirectionStart('right')
              handleDirectionStart('up')
            }}
            onTouchEnd={() => {
              handleDirectionEnd('right')
              handleDirectionEnd('up')
            }}
            className="w-10 h-10 bg-black bg-opacity-50 rounded-tr-lg border-2 border-cyan-500 flex items-center justify-center"
          >
            <div className="w-0 h-0 border-r-4 border-b-4 border-transparent border-r-cyan-500 border-b-cyan-500" />
          </button>

          {/* Middle Row */}
          <button
            onTouchStart={() => handleDirectionStart('left')}
            onTouchEnd={() => handleDirectionEnd('left')}
            className="w-10 h-10 bg-black bg-opacity-50 rounded-l-lg border-2 border-cyan-500 flex items-center justify-center"
          >
            <div className="w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-cyan-500" />
          </button>
          <div className="w-10 h-10" /> {/* Center space */}
          <button
            onTouchStart={() => handleDirectionStart('right')}
            onTouchEnd={() => handleDirectionEnd('right')}
            className="w-10 h-10 bg-black bg-opacity-50 rounded-r-lg border-2 border-cyan-500 flex items-center justify-center"
          >
            <div className="w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-l-cyan-500" />
          </button>

          {/* Bottom Row */}
          <button
            onTouchStart={() => {
              handleDirectionStart('left')
              handleDirectionStart('down')
            }}
            onTouchEnd={() => {
              handleDirectionEnd('left')
              handleDirectionEnd('down')
            }}
            className="w-10 h-10 bg-black bg-opacity-50 rounded-bl-lg border-2 border-cyan-500 flex items-center justify-center"
          >
            <div className="w-0 h-0 border-l-4 border-t-4 border-transparent border-l-cyan-500 border-t-cyan-500" />
          </button>
          <button
            onTouchStart={() => handleDirectionStart('down')}
            onTouchEnd={() => handleDirectionEnd('down')}
            className="w-10 h-10 bg-black bg-opacity-50 rounded-b-lg border-2 border-cyan-500 flex items-center justify-center"
          >
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-cyan-500" />
          </button>
          <button
            onTouchStart={() => {
              handleDirectionStart('right')
              handleDirectionStart('down')
            }}
            onTouchEnd={() => {
              handleDirectionEnd('right')
              handleDirectionEnd('down')
            }}
            className="w-10 h-10 bg-black bg-opacity-50 rounded-br-lg border-2 border-cyan-500 flex items-center justify-center"
          >
            <div className="w-0 h-0 border-r-4 border-t-4 border-transparent border-r-cyan-500 border-t-cyan-500" />
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 pointer-events-auto">
        <button
          onTouchStart={() => onGravityPull(true)}
          onTouchEnd={() => onGravityPull(false)}
          className="w-16 h-16 bg-black bg-opacity-50 rounded-full border-2 border-cyan-500 flex items-center justify-center"
        >
          <div className="w-10 h-10 bg-cyan-500 bg-opacity-30 rounded-full" />
        </button>
        <button
          onClick={onPause}
          className="w-16 h-16 bg-black bg-opacity-50 rounded-full border-2 border-cyan-500 flex items-center justify-center"
        >
          <div className="w-8 h-8 border-l-4 border-r-4 border-cyan-500" />
        </button>
      </div>
    </div>
  )
} 