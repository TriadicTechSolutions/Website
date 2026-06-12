import React, { useEffect, useState } from 'react'
import FilterBar from './components/FilterBar'
import Card from './components/Card'
import SearchModal from './components/SearchModal'

const DEFAULT_ITEMS = [
  { id: 'bitcoin', name: 'Bitcoin', category: 'Crypto', thumb: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png' },
  { id: 'ethereum', name: 'Ethereum', category: 'Crypto', thumb: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png' },
  { id: 'solana', name: 'Solana', category: 'Crypto', thumb: 'https://assets.coingecko.com/coins/images/4128/large/solana.png' },
  { id: 'SPY', name: 'S&P 500 (SPY)', category: 'Stock', thumb: null },
  { id: 'AAPL', name: 'Apple (AAPL)', category: 'Stock', thumb: 'https://www.apple.com/ac/structured-data/images/open_graph_logo.png?202301190703' },
  { id: 'NVDA', name: 'NVIDIA (NVDA)', category: 'Stock', thumb: 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Nvidia_logo.svg' }
]

export default function App(){
  const [items, setItems] = useState(()=>{
    try{ const raw = localStorage.getItem('dashboard_items'); return raw? JSON.parse(raw): DEFAULT_ITEMS }catch{ return DEFAULT_ITEMS }
  })
  const [range, setRange] = useState('24H')
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(()=>{ localStorage.setItem('dashboard_items', JSON.stringify(items)) }, [items])

  // track last-updated seconds and a refresh tick every 60s
  const [lastUpdatedSeconds, setLastUpdatedSeconds] = useState(0)
  const [refreshTick, setRefreshTick] = useState(0)
  const [draggedItem, setDraggedItem] = useState(null)
  const [dragOverKey, setDragOverKey] = useState(null)

  function handleDragStart(item) {
    setDraggedItem(item)
    setDragOverKey(null)
  }

  function handleDragEnter(event, targetItem) {
    event.preventDefault()
    if (!draggedItem) return

    const sourceKey = `${draggedItem.id}::${draggedItem.category}`
    const targetKey = `${targetItem.id}::${targetItem.category}`
    if (sourceKey === targetKey || targetKey === dragOverKey) return

    setItems((prev) => {
      const next = [...prev]
      const sourceIndex = next.findIndex((it) => it.id === draggedItem.id && it.category === draggedItem.category)
      const targetIndex = next.findIndex((it) => it.id === targetItem.id && it.category === targetItem.category)
      if (sourceIndex === -1 || targetIndex === -1) return prev
      const [moved] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
    setDragOverKey(targetKey)
  }

  function handleDrop(event) {
    event.preventDefault()
    setDraggedItem(null)
    setDragOverKey(null)
  }

  function handleDragEnd() {
    setDraggedItem(null)
    setDragOverKey(null)
  }

  useEffect(()=>{
    const t = setInterval(()=> setLastUpdatedSeconds(s=>s+1), 1000)
    return ()=> clearInterval(t)
  }, [])

  useEffect(()=>{
    const id = setInterval(()=>{
      setRefreshTick(n=>n+1)
      setLastUpdatedSeconds(0)
    }, 60000)
    return ()=> clearInterval(id)
  }, [])

  function handleAdd(item){
    setItems(prev=>[...prev, item])
  }
  function handleRemove(item){
    setItems(prev=>prev.filter(p=>!(p.id===item.id && p.category===item.category)))
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Price Tracker Dashboard</h1>
          <div className="flex items-center gap-3">
            <button onClick={()=>setModalOpen(true)} className="px-3 py-2 bg-blue-600 rounded">Add</button>
          </div>
        </header>
        <FilterBar range={range} setRange={setRange} lastUpdated={lastUpdatedSeconds} />

        <main>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((it) => (
              <Card
                key={it.id + ':' + it.category}
                item={it}
                rangeKey={range}
                onRemove={handleRemove}
                refreshTick={refreshTick}
                onDragHandleStart={() => handleDragStart(it)}
                onDragEnter={(e) => handleDragEnter(e, it)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                isDragging={draggedItem?.id === it.id && draggedItem?.category === it.category}
                isDragOver={dragOverKey === `${it.id}::${it.category}`}
              />
            ))}
          </div>
        </main>
      </div>

      <SearchModal open={modalOpen} onClose={()=>setModalOpen(false)} onAdd={handleAdd} />

      <div className="fixed right-6 bottom-6">
        <button onClick={()=>setModalOpen(true)} className="p-3 rounded-full bg-blue-600 shadow-lg">＋</button>
      </div>
    </div>
  )
}
