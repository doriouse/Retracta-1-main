import { useEffect, useState } from 'react';
import { auth } from './firebaseAuth';
import { DEFAULT_USER_DATA, subscribeToUserData } from './RetractaData';

export default function useRetractaData() {
  const [data, setData] = useState(DEFAULT_USER_DATA);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [hasSchedules, setHasSchedules] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeToUserData(
      uid,
      (value) => {
        setHasSchedules(value.schedules !== undefined);
        setData({
          ...DEFAULT_USER_DATA,
          ...value,
          device: { ...DEFAULT_USER_DATA.device, ...value.device },
          settings: {
            ...DEFAULT_USER_DATA.settings,
            ...value.settings,
            location: {
              ...DEFAULT_USER_DATA.settings.location,
              ...value.settings?.location,
            },
            notifications: {
              ...DEFAULT_USER_DATA.settings.notifications,
              ...value.settings?.notifications,
            },
          },
          schedules: value.schedules || [],
          history: value.history || [],
        });
        setLoaded(true);
        setLastSync(Date.now());
        setError('');
      },
      (firebaseError) => setError(firebaseError.message),
    );
  }, [uid]);

  return { data, error, uid, loaded, hasSchedules, lastSync };
}
