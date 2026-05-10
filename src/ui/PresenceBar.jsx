import { useEffect, useState } from 'react';
import { presenceStore } from '../state/presenceStore';

export default function PresenceBar({ serviceId }) {
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const update = () => {
      setOnlineUsers(serviceId ? presenceStore.getOnline(serviceId) : []);
    };
    update();
    const unsubscribe = presenceStore.subscribe(update);
    return unsubscribe;
  }, [serviceId]);

  if (!serviceId) {
    return <p className="presence-bar-placeholder">Join a service to see online users</p>;
  }

  if (onlineUsers.length === 0) {
    return <p className="presence-bar-placeholder">No users online</p>;
  }

  return (
    <div className="presence-bar">
      {onlineUsers.map((user) => (
        <div key={user.userId} className="presence-user" title={user.userName}>
          <span className={`presence-dot ${user.status === 'online' ? 'online' : 'offline'}`} />
          <span className="presence-name">{user.userName}</span>
        </div>
      ))}
    </div>
  );
}
