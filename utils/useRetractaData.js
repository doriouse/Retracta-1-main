import { useEffect, useState } from 'react';
import { auth } from './firebaseAuth';
import { DEFAULT_USER_DATA, LEGACY_VARAL_ID, subscribeToUserData } from './RetractaData';

export default function useRetractaData() {
  const [data, setData] = useState(DEFAULT_USER_DATA);
  const [varais, setVarais] = useState([]);
  const [activeVaralId, setActiveVaralId] = useState(LEGACY_VARAL_ID);
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
        const registeredVarais = Object.entries(value.varais || {})
          .filter(([, varal]) => varal && typeof varal === 'object')
          .map(([id, varal]) => ({
            ...varal,
            id,
            legacy: false,
            location: varal.settings?.location || varal.location || DEFAULT_USER_DATA.settings.location,
          }));
        const legacyVaral = {
          id: LEGACY_VARAL_ID,
          name: value.device?.name || 'Varal principal',
          deviceId: value.device?.id || '',
          location: value.settings?.location || DEFAULT_USER_DATA.settings.location,
          device: value.device || {},
          legacy: true,
        };
        const availableVarais = [legacyVaral, ...registeredVarais];
        const requestedId = value.settings?.activeVaralId;
        const selectedId = availableVarais.some((varal) => varal.id === requestedId)
          ? requestedId
          : LEGACY_VARAL_ID;
        const selectedVaral = selectedId === LEGACY_VARAL_ID
          ? value
          : value.varais?.[selectedId] || {};
        const selectedLocation = selectedVaral.settings?.location
          || selectedVaral.location
          || DEFAULT_USER_DATA.settings.location;

        setVarais(availableVarais);
        setActiveVaralId(selectedId);
        setHasSchedules(selectedVaral.schedules !== undefined);
        setData({
          ...DEFAULT_USER_DATA,
          ...selectedVaral,
          device: { ...DEFAULT_USER_DATA.device, ...selectedVaral.device },
          settings: {
            ...DEFAULT_USER_DATA.settings,
            ...selectedVaral.settings,
            location: {
              ...DEFAULT_USER_DATA.settings.location,
              ...selectedLocation,
            },
            notifications: {
              ...DEFAULT_USER_DATA.settings.notifications,
              ...selectedVaral.settings?.notifications,
            },
          },
          schedules: selectedVaral.schedules || [],
          history: selectedVaral.history || [],
        });
        setLoaded(true);
        setLastSync(Date.now());
        setError('');
      },
      (firebaseError) => setError(firebaseError.message),
    );
  }, [uid]);

  const activeVaral = varais.find((varal) => varal.id === activeVaralId) || varais[0];
  return { data, error, uid, loaded, hasSchedules, lastSync, varais, activeVaralId, activeVaral };
}
