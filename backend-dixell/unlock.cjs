const ModbusRTU = require("modbus-serial");
const client = new ModbusRTU();
const serialPort = "/dev/tty.usbserial-110"; 
const SLAVE_ID = 144;

async function intentoFinal() {
    try {
        console.log("--- Intento Final de Escritura (Timeout Largo) ---");
        await client.connectRTUBuffered(serialPort, { baudRate: 9600 });
        client.setID(SLAVE_ID);
        
        // Le damos 5 segundos de paciencia al equipo
        client.setTimeout(5000);

        // Esperamos 1 segundo de silencio total en el cable antes de escribir
        console.log("Estabilizando línea...");
        await new Promise(r => setTimeout(r, 1000));

        const valorAEscribir = 25; // 2.5°C
        console.log(`Enviando ${valorAEscribir / 10}°C al registro 1536...`);
        
        await client.writeRegister(1536, valorAEscribir);
        
        console.log("✅ ¡ESCRITURA EXITOSA!");
        
        const confirm = await client.readHoldingRegisters(1536, 1);
        console.log(`Valor final en equipo: ${confirm.data[0] / 10}°C`);

    } catch (e) {
        console.error("❌ Falló:", e.message);
        if (e.message.includes("Timed out")) {
            console.log("\nANÁLISIS: El equipo recibe el dato pero no confirma.");
            console.log("Probá esto: Mirá el display del Dixell NI BIEN termine el script.");
            console.log("¿Cambió a 2.5 aunque diga Timed out?");
        }
    } finally {
        client.close();
        process.exit();
    }
}
intentoFinal();