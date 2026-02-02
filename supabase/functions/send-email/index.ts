// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import nodemailer from "npm:nodemailer@6.9.7"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Agregamos el tipo ': Request' para arreglar el error de 'any'
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, config, data } = await req.json()

    if (!config?.email_host || !config?.email_user || !config?.email_pass) {
        throw new Error("Faltan credenciales SMTP")
    }

    const transporter = nodemailer.createTransport({
      host: config.email_host,
      port: Number(config.email_port),
      secure: Number(config.email_port) === 465, 
      auth: { user: config.email_user, pass: config.email_pass },
    })

    const mailOptions: any = {
      from: `"Sistema POS" <${config.email_user}>`,
      to: config.email_to,
    }

    if (action === 'TEST') {
        mailOptions.subject = "✅ Prueba de Conexión POS";
        mailOptions.text = "El sistema de correos funciona correctamente.";
    } 
    else if (action === 'BACKUP') {
        // ... lógica de backup
        const date = new Date().toLocaleDateString('es-PE');
        mailOptions.subject = `📦 Backup POS - ${date}`;
        mailOptions.text = "Adjunto respaldo de base de datos.";
        mailOptions.attachments = [{
            filename: `backup_${Date.now()}.json`,
            content: JSON.stringify(data, null, 2),
            contentType: 'application/json'
        }];
    }

    const info = await transporter.sendMail(mailOptions);
    return new Response(JSON.stringify(info), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    // Aquí definimos error como 'any' para poder acceder a .message sin problemas
    return new Response(JSON.stringify({ error: error.message || 'Error desconocido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})