import { useState } from 'react'
import './App.css'

export default function App() {
  const [count, setCount] = useState(0)
  const [name, setName] = useState('unknown')

  return (
    <div className="app">
      <h1>Vite + React + Cloudflare</h1>
      <div className="card">
        <button
          type="button"
          onClick={() => setCount((value) => value + 1)}
          aria-label="increment"
        >
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <div className="card">
        <button
          type="button"
          onClick={() => {
            fetch('/api/')
              .then((res) => res.json() as Promise<{ name: string }>)
              .then((data) => setName(data.name))
          }}
          aria-label="get name"
        >
          Name from API is: {name}
        </button>
        <p>
          Edit <code>worker/routes/index.route.ts</code> to change the name
        </p>
      </div>
    </div>
  )
}
