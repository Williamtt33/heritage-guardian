import { useState, useCallback, useEffect, useRef } from 'react'
import type { Hotspot, Vector3Like } from '../types'
import { uid } from '../types'
import { getHotspots, saveHotspots } from '../store'

interface UseHotspotsResult {
  hotspots: Hotspot[]
  selectedHotspot: Hotspot | null
  editingHotspot: Hotspot | null
  isPlacingHotspot: boolean
  selectHotspot: (hs: Hotspot | null) => void
  editHotspot: (hs: Hotspot | null) => void
  startPlacing: () => void
  cancelPlacing: () => void
  placeHotspot: (position: Vector3Like, cameraPosition: Vector3Like, cameraTarget: Vector3Like) => void
  updateHotspot: (id: string, updates: Partial<Hotspot>) => void
  deleteHotspot: (id: string) => void
  hotspotsRef: React.RefObject<Hotspot[]>
}

export function useHotspots(modelId: string): UseHotspotsResult {
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null)
  const [editingHotspot, setEditingHotspot] = useState<Hotspot | null>(null)
  const [isPlacingHotspot, setIsPlacingHotspot] = useState(false)
  const hotspotsRef = useRef<Hotspot[]>([])

  // Load hotspots on mount
  useEffect(() => {
    getHotspots(modelId).then(hs => {
      setHotspots(hs)
      hotspotsRef.current = hs
    })
  }, [modelId])

  const persist = useCallback(async (hs: Hotspot[]) => {
    setHotspots(hs)
    hotspotsRef.current = hs
    await saveHotspots(modelId, hs)
  }, [modelId])

  const selectHotspot = useCallback((hs: Hotspot | null) => {
    setSelectedHotspot(hs)
    setEditingHotspot(null)
    setIsPlacingHotspot(false)
  }, [])

  const editHotspot = useCallback((hs: Hotspot | null) => {
    setEditingHotspot(hs)
    setSelectedHotspot(null)
  }, [])

  const startPlacing = useCallback(() => {
    setIsPlacingHotspot(true)
    setSelectedHotspot(null)
    setEditingHotspot(null)
  }, [])

  const cancelPlacing = useCallback(() => {
    setIsPlacingHotspot(false)
  }, [])

  const placeHotspot = useCallback(async (position: Vector3Like, cameraPosition: Vector3Like, cameraTarget: Vector3Like) => {
    const hs: Hotspot = {
      id: uid(),
      position,
      title: '',
      description: '',
      note: '',
      order: hotspots.length + 1,
      cameraPosition,
      cameraTarget,
    }
    await persist([...hotspots, hs])
    setIsPlacingHotspot(false)
    setEditingHotspot(hs)
  }, [hotspots, persist])

  const updateHotspot = useCallback(async (id: string, updates: Partial<Hotspot>) => {
    const next = hotspots.map(h => h.id === id ? { ...h, ...updates } : h)
    await persist(next)
    if (editingHotspot?.id === id) {
      setEditingHotspot(next.find(h => h.id === id) ?? null)
    }
  }, [hotspots, persist, editingHotspot])

  const deleteHotspot = useCallback(async (id: string) => {
    await persist(hotspots.filter(h => h.id !== id))
    if (editingHotspot?.id === id) setEditingHotspot(null)
    if (selectedHotspot?.id === id) setSelectedHotspot(null)
  }, [hotspots, persist, editingHotspot, selectedHotspot])

  return {
    hotspots, selectedHotspot, editingHotspot, isPlacingHotspot,
    selectHotspot, editHotspot, startPlacing, cancelPlacing,
    placeHotspot, updateHotspot, deleteHotspot,
    hotspotsRef,
  }
}
