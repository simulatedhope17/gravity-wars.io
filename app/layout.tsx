import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'gravity-wars.io',
  description: 'gravity wars io game',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
