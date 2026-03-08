import { SupabaseClient } from '@supabase/supabase-js';

export const sendBackupToTelegram = async (
    supabase: SupabaseClient, 
    token: string, 
    chatId: string
): Promise<boolean> => {
    try {
        // 1. Recopilar datos de todas las tablas importantes
        const tables = ['orders', 'products', 'customers', 'users', 'config', 'system_logs'];
        const backupData: any = { timestamp: new Date().toISOString() };
        
        for (const t of tables) {
            const { data } = await supabase.from(t).select('*');
            backupData[t] = data;
        }

        // 2. Crear archivo JSON en memoria
        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        
        // 3. Preparar el envío (FormData)
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('document', blob, `backup_${new Date().toLocaleDateString('es-PE').replace(/\//g,'-')}.json`);
        formData.append('caption', `📦 **Backup Sistema Pizza**\n📅 ${new Date().toLocaleString()}`);

        // 4. Enviar a la API de Telegram
        const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
            method: 'POST',
            body: formData
        });

        const result = await res.json();
        return result.ok;

    } catch (error) {
        console.error("Error Telegram Backup:", error);
        return false;
    }
};