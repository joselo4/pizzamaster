import { useMemo } from 'react';
import { useStoreConfigContext } from '../core/context/StoreConfigContext';
import { resolveOrderAvailability, resolveDeliveryPolicy } from '../core/services/businessRules';

export function useStoreConfig() {
  const ctx = useStoreConfigContext();

  return useMemo(() => {
    const orderAvailability = resolveOrderAvailability(ctx.config, new Date());
    const deliveryPolicy = resolveDeliveryPolicy(ctx.config, 0);
    return { ...ctx, orderAvailability, deliveryPolicy };
  }, [ctx]);
}
