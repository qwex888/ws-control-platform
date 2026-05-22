import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../../../components/ui/tooltip'
import { ControlPanel } from '../ControlPanel'

describe('baseline controls', () => {
  it('renders required ws-scrcpy baseline controls', () => {
    const send = vi.fn()
    render(
      <TooltipProvider>
        <ControlPanel send={send} />
      </TooltipProvider>
    )

    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /recent/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /power/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /vol\+/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /vol-/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rotate/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /screenshot/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /paste/i })).toBeInTheDocument()
  })
})
