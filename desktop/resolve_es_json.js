const fs = require('fs');
const content = fs.readFileSync('./src/locales/es.json', 'utf8');

// Estrategia simple: Quedarnos con el bloque "Updated upstream" (lo nuevo del servidor)
// pero asegurándonos de que nuestras claves críticas de llamadas estén en el bloque final.

let cleanContent = content
    .replace(/<<<<<<< Updated upstream[\s\S]*?=======/g, (match) => {
        return match.replace('<<<<<<< Updated upstream', '').replace('=======', '');
    })
    .replace(/>>>>>>> Stashed changes/g, '')
    .replace(/=======[\s\S]*?>>>>>>> Stashed changes/g, '');

// Intentamos parsear para ver si es válido
try {
    const obj = JSON.parse(cleanContent);
    
    // Aseguramos nuestras claves en la sección call
    if (obj.call) {
        obj.call.waiting_admission = "Esperando admisión...";
        obj.call.waiting = "Esperando...";
        obj.call.active_session = "Sesión de {{type}} activa";
        obj.call.video = "vídeo";
        obj.call.audio = "audio";
    }
    
    fs.writeFileSync('./src/locales/es.json', JSON.stringify(obj, null, 4), 'utf8');
    console.log('es.json reparado y actualizado');
} catch (e) {
    console.error('Error al reparar JSON:', e.message);
}
