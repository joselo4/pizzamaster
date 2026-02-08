
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { refreshConfigCache } from '../lib/configCache';

/**
 * AppIdentityLoader
 * - Carga nombre_tienda y logo_url desde config y actualiza:
 *   - document.title
 *   - favicon (link[rel~='icon'])
 *
 * Se ejecuta también en rutas públicas (sin login), para que no aparezca "pizzeria-app".
 */
export default function AppIdentityLoader() {
  const location = useLocation();

  useEffect(() => {
    const applyIdentity = async () => {
      try {
        // refresca cache (usa RLS public_read para nombre_tienda/logo_url)
        const cfg = await refreshConfigCache();
        const nombre = cfg?.nombre_tienda || cfg?.business_name;
        const logo = cfg?.logo_url;

        if (nombre) document.title = String(nombre);
        if (logo) {
          let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.getElementsByTagName('head')[0].appendChild(link);
          }
          link.href = String(logo);
        }
      } catch {
        // ignore (sin permisos o sin internet)
      }
    };

    applyIdentity();
  }, [location.pathname]);

  // No render UI
  return null;
}
