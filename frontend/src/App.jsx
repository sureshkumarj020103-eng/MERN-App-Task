import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, { MiniMap, Controls, Background } from 'reactflow';
import 'reactflow/dist/style.css';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Type a prompt and click Run Flow.');
  const [history, setHistory] = useState([]);

  const nodes = useMemo(() => [
    {
      id: '1',
      position: { x: 30, y: 50 },
      data: {
        label: (
          <div className="node-content">
            <h3>Text Input Node</h3>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter prompt here"
              className="node-textarea"
            />
          </div>
        )
      },
      style: { width: 320 }
    },
    {
      id: '2',
      position: { x: 420, y: 50 },
      data: {
        label: (
          <div className="node-content">
            <h3>Result Node</h3>
            <div className="result-box">{loading ? 'Loading...' : answer || 'AI result appears here'}</div>
          </div>
        )
      },
      style: { width: 320 }
    }
  ], [prompt, answer, loading]);

  const edges = useMemo(() => [{ id: 'e1-2', source: '1', target: '2', animated: true }], []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history');
      if (!res.ok) throw new Error('History fetch failed');
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const runFlow = async () => {
    if (!prompt.trim()) {
      setStatus('Prompt cannot be empty.');
      return;
    }
    setLoading(true);
    setStatus('Sending prompt to backend...');

    try {
      const response = await fetch('/api/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'AI call failed');
      }
      const data = await response.json();
      setAnswer(data.response);
      setStatus('AI response received. Save if you like.');
    } catch (err) {
      console.error(err);
      setStatus('Failed to get AI response: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveCurrent = async () => {
    if (!prompt.trim() || !answer.trim()) {
      setStatus('Need both prompt and AI response before saving.');
      return;
    }
    try {
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, response: answer })
      });
      if (!response.ok) throw new Error('Save failed');
      setStatus('Saved to MongoDB.');
      fetchHistory();
    } catch (err) {
      console.error(err);
      setStatus('Save failed: ' + err.message);
    }
  };

  return (
    <div className="app-container">
      <h1>MERN App Task - AI Flow</h1>
      <div className="controls">
        <button onClick={runFlow} disabled={loading}>Run Flow</button>
        <button onClick={saveCurrent} disabled={loading || !answer}>Save</button>
      </div>
      <p className="status">{status}</p>

      <div className="flow-wrapper">
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </div>

      <div className="history">
        <h2>Saved History (MongoDB)</h2>
        {history.length === 0 ? <p>No saved entries yet.</p> : (
          <div className="history-list">
            {history.map((item) => (
              <div key={item._id} className="history-item">
                <div><strong>Prompt:</strong> {item.prompt}</div>
                <div><strong>Response:</strong> {item.response}</div>
                <div><small>{new Date(item.createdAt).toLocaleString()}</small></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
