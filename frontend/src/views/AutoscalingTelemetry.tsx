import React, { useState, useEffect, useRef } from 'react';
import { Activity, Server, ArrowUpRight, ArrowDownRight, RefreshCw, Play, Square, Terminal as TerminalIcon } from 'lucide-react';

interface TelemetryData {
  hostname: string;
  platform: string;
  uptime: number;
  cpuUsage: number;
  memoryUsage: number;
  loadAverage: string;
  cpuSpikeActive: boolean;
  timestamp: string;
}

interface ServerInstance {
  id: string;
  name: string;
  ip: string;
  status: 'healthy' | 'launching' | 'terminating';
  cpu: number;
  requestsCount: number;
}

interface LogEntry {
  time: string;
  type: 'info' | 'warn' | 'success' | 'danger';
  message: string;
}

interface Props {
  apiBase: string;
}

const AutoscalingTelemetry: React.FC<Props> = ({ apiBase }) => {
  const [metrics, setMetrics] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [instances, setInstances] = useState<ServerInstance[]>([
    { id: 'i-09f1a238b7d4c5e60', name: 'Primary Node (Active)', ip: '10.0.1.42', status: 'healthy', cpu: 5, requestsCount: 124 }
  ]);
  const [logs, setLogs] = useState<LogEntry[]>([
    { time: new Date().toLocaleTimeString(), type: 'info', message: 'ASG Initialized. Desired: 1, Min: 1, Max: 6.' },
    { time: new Date().toLocaleTimeString(), type: 'success', message: 'Target Group health checks passing for Primary Node.' },
    { time: new Date().toLocaleTimeString(), type: 'info', message: 'ALB routing 100% traffic to i-09f1a238b7d4c5e60.' }
  ]);
  const [trafficRate, setTrafficRate] = useState(12); // requests per sec
  
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Add a log helper
  const addLog = (message: string, type: 'info' | 'warn' | 'success' | 'danger' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { time, type, message }].slice(-50)); // Keep last 50
  };

  // Scroll to bottom of terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Fetch telemetry from backend
  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${apiBase}/metrics`);
      if (!res.ok) throw new Error('Failed to retrieve metrics');
      const data: TelemetryData = await res.json();
      
      setMetrics(data);
      setError(null);

      // Dynamically update the instance list and simulate load balancer behaviors
      setInstances(prev => {
        const primary = { ...prev[0] };
        primary.cpu = data.cpuUsage;
        primary.name = `Primary Node (${data.hostname})`;
        
        const list = [primary];
        
        // If CPU is spiked, simulate ASG scaling after alarm delay
        if (data.cpuUsage > 70) {
          // If we only have 1 node, spawn node 2
          if (prev.length === 1) {
            addLog('CloudWatch Alarm triggered: CPU >70% for 5 consecutive periods of 10s', 'danger');
            addLog('Auto Scaling Group Policy: Scaling Out -> Launch 1 new EC2 Instance.', 'warn');
            
            list.push({
              id: 'i-0ab4c67ef890123d4',
              name: 'ASG Auto-Scaled Node 1',
              ip: '10.0.1.189',
              status: 'launching',
              cpu: 10,
              requestsCount: 0
            });
            setTimeout(() => {
              setInstances(current => {
                if (current[1]) {
                  const node2 = { ...current[1], status: 'healthy' as const };
                  addLog('Target Group Health Check: New instance i-0ab4c67ef890123d4 is HEALTHY', 'success');
                  addLog('ALB Target Group Updated. Rebalancing load: 50% / 50%.', 'info');
                  return [current[0], node2];
                }
                return current;
              });
            }, 6000);
          } else if (prev.length === 2 && prev[1].status === 'healthy') {
            // Node 2 is healthy, let's distribute the load
            const node2 = { ...prev[1] };
            node2.cpu = Math.round(data.cpuUsage * 0.85); // slightly less load
            list.push(node2);
            
            // If traffic is still extremely high, trigger scale out 3
            if (data.cpuUsage > 80 && Math.random() > 0.6) {
              addLog('Auto Scaling Policy: High Traffic persistence. Scaling Out -> Launching ASG Node 2.', 'warn');
              list.push({
                id: 'i-0bc5d78fa901234e5',
                name: 'ASG Auto-Scaled Node 2',
                ip: '10.0.1.205',
                status: 'launching',
                cpu: 5,
                requestsCount: 0
              });
              setTimeout(() => {
                setInstances(current => {
                  if (current[2]) {
                    const node3 = { ...current[2], status: 'healthy' as const };
                    addLog('Target Group Health Check: Instance i-0bc5d78fa901234e5 is HEALTHY', 'success');
                    addLog('ALB Target Group Updated. Rebalancing load: 33% / 33% / 33%.', 'info');
                    return [current[0], current[1], node3];
                  }
                  return current;
                });
              }, 6000);
            }
          } else {
            // Keep existing scaled instances
            list.push(...prev.slice(1));
          }
        } else if (data.cpuUsage < 30) {
          // If CPU is low and we have extra nodes, scale in
          if (prev.length > 1) {
            const lastNode = prev[prev.length - 1];
            if (lastNode.status !== 'terminating') {
              addLog('CloudWatch Alarm triggered: CPU <30% cool down duration reached.', 'success');
              addLog(`Auto Scaling Policy: Scaling In -> Terminate Instance ${lastNode.id}.`, 'danger');
              
              const updatedLast = { ...lastNode, status: 'terminating' as const };
              const currentList = [...prev];
              currentList[currentList.length - 1] = updatedLast;
              
              setTimeout(() => {
                setInstances(curr => {
                  const final = curr.filter(n => n.id !== lastNode.id);
                  addLog(`ALB: Removed instance ${lastNode.id} from Target Group.`, 'info');
                  addLog(`Auto Scaling: Instance ${lastNode.id} successfully terminated.`, 'danger');
                  return final;
                });
              }, 6000);
              
              return currentList;
            } else {
              list.push(...prev.slice(1));
            }
          }
        } else {
          // Normal CPU: Keep what we have
          list.push(...prev.slice(1));
        }

        // Simulate incoming requests count increasing
        const rate = data.cpuUsage > 70 ? trafficRate * 4 : trafficRate;
        const activeNodesCount = list.filter(n => n.status === 'healthy').length;
        
        return list.map(inst => {
          if (inst.status === 'healthy') {
            return {
              ...inst,
              requestsCount: inst.requestsCount + Math.round((rate / activeNodesCount) * 2)
            };
          }
          return inst;
        });
      });
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Start polling metrics on mount
  useEffect(() => {
    fetchMetrics();
    pollingRef.current = setInterval(fetchMetrics, 2000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [trafficRate]);

  // Handle spiking the CPU
  const triggerSpike = async () => {
    try {
      addLog('Initiating HTTP Load Spike. Sending 50,000 requests using simulated Apache Benchmark...', 'warn');
      const res = await fetch(`${apiBase}/metrics/cpu-spike`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: 90 })
      });
      if (res.ok) {
        setTrafficRate(140);
        addLog('Server CPU utilization surging above threshold (>70%)!', 'danger');
        fetchMetrics();
      }
    } catch (err) {
      console.error(err);
      addLog('Failed to start CPU spike', 'danger');
    }
  };

  // Handle cooling down the CPU
  const triggerCooldown = async () => {
    try {
      addLog('Stopping Apache Benchmark traffic load generation...', 'info');
      const res = await fetch(`${apiBase}/metrics/cpu-cooldown`, {
        method: 'POST'
      });
      if (res.ok) {
        setTrafficRate(12);
        addLog('Server load decreasing. CPU utilization cool down initiated.', 'success');
        fetchMetrics();
      }
    } catch (err) {
      console.error(err);
      addLog('Failed to clear CPU spike', 'danger');
    }
  };

  return (
    <div className="app-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Auto Scaling Telemetry</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Real-time monitoring of Application Load Balancer (ALB) and Auto Scaling Group (ASG).
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchMetrics} style={{ height: 'fit-content' }}>
          <RefreshCw size={16} /> Force Refresh
        </button>
      </div>

      {error && (
        <div className="glass-card" style={{ borderColor: 'var(--color-rose)', marginBottom: '24px', padding: '16px' }}>
          <p style={{ color: 'var(--color-rose)' }}>⚠️ Connect Error: {error}. Make sure the backend server is running on port 5000.</p>
        </div>
      )}

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        
        {/* CPU Util Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>System CPU Load</span>
            <Activity size={20} className={metrics?.cpuSpikeActive ? 'bg-rose' : 'bg-cyan'} style={{ color: 'white', borderRadius: '4px', padding: '2px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-header)' }}>
              {metrics ? `${metrics.cpuUsage}%` : 'N/A'}
            </span>
            <span style={{ color: (metrics?.cpuUsage || 0) > 70 ? 'var(--color-rose)' : 'var(--color-emerald)', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>
              {(metrics?.cpuUsage || 0) > 70 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {(metrics?.cpuUsage || 0) > 70 ? 'Spike Threshold Exceeded' : 'Normal Load'}
            </span>
          </div>
          <div className="progress-bar-container">
            <div 
              className={`progress-bar-fill ${
                (metrics?.cpuUsage || 0) > 70 
                  ? 'bg-rose' 
                  : (metrics?.cpuUsage || 0) > 40 
                  ? 'bg-amber' 
                  : 'bg-cyan'
              }`}
              style={{ width: `${metrics ? metrics.cpuUsage : 0}%` }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Scale In: &lt;30%</span>
            <span>Scale Out: &gt;70%</span>
          </div>
        </div>

        {/* Instances Count Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>EC2 Instances</span>
            <Server size={20} style={{ color: 'var(--color-purple)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>
              {instances.length}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              / 6 Max
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <div 
                key={idx}
                style={{
                  height: '8px',
                  flex: 1,
                  borderRadius: '4px',
                  background: idx < instances.length 
                    ? (instances[idx]?.status === 'launching' ? 'var(--color-amber)' : 'var(--color-emerald)') 
                    : 'rgba(255,255,255,0.05)'
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Desired: {instances.length} | Min: 1 | Max: 6
          </span>
        </div>

        {/* Network Traffic Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>ALB Ingress Traffic</span>
            <Activity size={20} style={{ color: 'var(--color-amber)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>
              {metrics?.cpuSpikeActive ? trafficRate * 5 : trafficRate}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Requests / sec
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Healthy Targets: {instances.filter(i => i.status === 'healthy').length} / {instances.length}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
            <span className={`pulse-indicator ${metrics?.cpuSpikeActive ? 'pulse-amber' : 'pulse-emerald'}`} />
            <span style={{ color: 'var(--text-muted)' }}>ALB Routing: Round Robin</span>
          </div>
        </div>

      </div>

      {/* Grid: Actions & Instances List */}
      <div className="grid-cols-12" style={{ marginBottom: '30px' }}>
        
        {/* Left Column: Traffic Control & Server Info */}
        <div style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Traffic Injector Panel */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Traffic Generator</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Simulate high concurrent visitor spikes using Apache Benchmark to verify AWS Auto Scaling triggers.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                className="btn btn-primary" 
                onClick={triggerSpike}
                disabled={metrics?.cpuSpikeActive}
                style={{ width: '100%', opacity: metrics?.cpuSpikeActive ? 0.6 : 1 }}
              >
                <Play size={16} /> Inject High Traffic Load
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={triggerCooldown}
                disabled={!metrics?.cpuSpikeActive}
                style={{ width: '100%', borderColor: 'rgba(244,63,94,0.3)', color: 'var(--color-rose)' }}
              >
                <Square size={16} /> Stop Traffic Generation
              </button>
            </div>
          </div>

          {/* Connected Host Telemetry */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '12px' }}>Host Telemetry</h3>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>Host Name</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{metrics?.hostname || 'Connecting...'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>Platform</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', textTransform: 'capitalize' }}>{metrics?.platform || 'N/A'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>Memory Usage</td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>{metrics ? `${metrics.memoryUsage}%` : 'N/A'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>Uptime</td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>{metrics ? `${Math.floor(metrics.uptime / 60)}m ${metrics.uptime % 60}s` : 'N/A'}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

        {/* Right Column: ALB Target Group Nodes */}
        <div style={{ gridColumn: 'span 7' }} className="glass-card">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ALB Target Group Health Status <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>(Healthy: {instances.filter(i => i.status === 'healthy').length})</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {instances.map((inst, index) => (
              <div 
                key={inst.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '16px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Visual glow indicator for active servers */}
                <div 
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '4px',
                    background: inst.status === 'healthy' 
                      ? 'var(--color-emerald)' 
                      : inst.status === 'launching' 
                      ? 'var(--color-amber)' 
                      : 'var(--color-rose)'
                  }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingLeft: '8px' }}>
                  <Server 
                    size={32} 
                    style={{ 
                      color: inst.status === 'healthy' 
                        ? 'var(--color-emerald)' 
                        : inst.status === 'launching' 
                        ? 'var(--color-amber)' 
                        : 'var(--color-rose)' 
                    }} 
                  />
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{inst.name}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      ID: {inst.id} | Private IP: {inst.ip}
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', marginBottom: '4px' }}>
                    <span 
                      className={`pulse-indicator ${
                        inst.status === 'healthy' 
                          ? 'pulse-emerald' 
                          : inst.status === 'launching' 
                          ? 'pulse-amber' 
                          : 'pulse-rose'
                      }`} 
                    />
                    <span 
                      style={{ 
                        fontSize: '0.8rem', 
                        fontWeight: 600, 
                        textTransform: 'uppercase',
                        color: inst.status === 'healthy' 
                          ? 'var(--color-emerald)' 
                          : inst.status === 'launching' 
                          ? 'var(--color-amber)' 
                          : 'var(--color-rose)'
                      }}
                    >
                      {inst.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    CPU: {inst.cpu}% | Req Served: {inst.requestsCount}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>

      {/* CloudWatch Logs Console (Terminal) */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TerminalIcon size={18} style={{ color: 'var(--color-cyan)' }} /> AWS CloudWatch Alarms & System Logs
          </h3>
          <button 
            className="btn btn-secondary" 
            onClick={() => setLogs([])}
            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
          >
            Clear Console
          </button>
        </div>

        <div className="terminal-view">
          <div className="terminal-header">
            <div className="terminal-dots">
              <span className="terminal-dot red" />
              <span className="terminal-dot yellow" />
              <span className="terminal-dot green" />
            </div>
            <span>aws-autoscaling-group-events.log</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {logs.map((log, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '12px' }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>[{log.time}]</span>
                <span 
                  style={{ 
                    color: log.type === 'success' 
                      ? 'var(--color-emerald)' 
                      : log.type === 'warn' 
                      ? 'var(--color-amber)' 
                      : log.type === 'danger' 
                      ? 'var(--color-rose)' 
                      : '#38bdf8' 
                  }}
                >
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoscalingTelemetry;
