// js/services/currencyService.js
/**
 * Servicio de divisas.
 *
 * - Obtiene las tasas de cambio (hoy y ayer) de forma ASÍNCRONA con Promesas.
 * - Convierte montos entre COP, USD, EUR y BTC.
 * - Guarda los saldos en divisas (billeteras) y el historial de exchanges.
 * - Ejecuta el exchange ficticio entre una cuenta COP y una billetera.
 *
 * ── ¿Cómo encaja el Event Loop aquí? ──────────────────────────────────────
 *  1. fetch() y setTimeout() se delegan al navegador (Web APIs), así la
 *     interfaz NO se congela mientras esperamos la respuesta.
 *  2. Cuando la respuesta llega, la Promesa se resuelve y sus .then() /
 *     el código después de un `await` se encolan en la MICROTASK QUEUE.
 *  3. El Event Loop vacía la Microtask Queue apenas termina el código
 *     síncrono actual, antes de pintar o de atender otra macrotarea
 *     (clicks, timers). Por eso las tarjetas se actualizan en cuanto hay datos.
 * ─────────────────────────────────────────────────────────────────────────
 */
class CurrencyService {
    static STORAGE_KEY = 'mi_plata_divisas';
    static CACHE_MS = 5 * 60 * 1000;     // reutiliza tasas durante 5 minutos
    static TIMEOUT_MS = 5000;            // tiempo máximo de espera de la API
    static LATENCIA_EXCHANGE_MS = 700;   // simula el procesamiento del "banco"

    static MONEDA_BASE = 'COP';

    static DIVISAS = Object.freeze({
        USD: { nombre: 'Dólar estadounidense', icono: 'attach_money' },
        EUR: { nombre: 'Euro',                 icono: 'euro' },
        BTC: { nombre: 'Bitcoin',              icono: 'currency_bitcoin' }
    });

    // Fuentes de la API pública gratuita (sin API key). Si la primera falla,
    // se usa la segunda (mirror recomendado por el mismo proyecto).
    static FUENTES = [
        (fecha) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${fecha}/v1/currencies/cop.min.json`,
        (fecha) => `https://${fecha}.currency-api.pages.dev/v1/currencies/cop.min.json`
    ];

    // Valores de referencia para el modo simulado (sin internet)
    static TASAS_REFERENCIA = Object.freeze({ USD: 4150, EUR: 4480, BTC: 420000000 });

    static #cache = null;          // { datos, timestamp }
    static #peticionEnCurso = null; // evita pedir lo mismo dos veces a la vez

    // =====================================================================
    //  TASAS DE CAMBIO
    // =====================================================================

    /**
     * Devuelve una Promesa con las tasas de hoy y de ayer:
     * {
     *   fecha, fechaAnterior, fuente: 'api' | 'simulada',
     *   divisas: { USD: { actual, anterior, variacion, variacionPct, tendencia }, ... }
     * }
     * `actual` y `anterior` están expresadas en COP por 1 unidad de la divisa.
     */
    static obtenerTasas({ forzar = false } = {}) {
        const cacheVigente = this.#cache &&
            (Date.now() - this.#cache.timestamp) < this.CACHE_MS;

        if (!forzar && cacheVigente) {
            // Promise.resolve: el .then() del que llama igual corre como microtarea
            return Promise.resolve(this.#cache.datos);
        }
        if (this.#peticionEnCurso) return this.#peticionEnCurso;

        this.#peticionEnCurso = this.#consultarApi()
            .catch((error) => {
                console.warn('[CurrencyService] API no disponible, usando tasas simuladas:', error.message);
                return this.#generarTasasSimuladas();
            })
            .then((datos) => {
                this.#cache = { datos, timestamp: Date.now() };
                return datos;
            })
            .finally(() => {
                this.#peticionEnCurso = null;
            });

        return this.#peticionEnCurso;
    }

    /** Pide la tasa más reciente y LUEGO la del día anterior (cadena de promesas) */
    static async #consultarApi() {
        const hoy = await this.#descargarConRespaldo('latest');
        const fechaHoy = hoy.date;                       // ej: "2026-11-09"
        const fechaAyer = this.#restarDias(fechaHoy, 1);
        const ayer = await this.#descargarConRespaldo(fechaAyer);

        const divisas = {};
        Object.keys(this.DIVISAS).forEach((codigo) => {
            const clave = codigo.toLowerCase();
            const porCopHoy = hoy.cop?.[clave];   // cuántos USD vale 1 COP
            const porCopAyer = ayer.cop?.[clave];
            if (!porCopHoy || !porCopAyer) {
                throw new Error(`La API no devolvió la tasa de ${codigo}`);
            }
            // Invertimos para tener COP por 1 unidad de la divisa
            divisas[codigo] = this.#armarTasa(1 / porCopHoy, 1 / porCopAyer);
        });

        return { fecha: fechaHoy, fechaAnterior: fechaAyer, fuente: 'api', divisas };
    }

    /** Intenta cada fuente; Promise.any se queda con la primera que funcione */
    static #descargarConRespaldo(fecha) {
        const intentos = this.FUENTES.map((url) => this.#fetchConTimeout(url(fecha)));
        return Promise.any(intentos).catch(() => {
            throw new Error(`Ninguna fuente respondió para ${fecha}`);
        });
    }

    /** fetch + timeout usando Promise.race (gana el que termine primero) */
    static #fetchConTimeout(url) {
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Tiempo de espera agotado')), this.TIMEOUT_MS)
        );
        const peticion = fetch(url).then((resp) => {
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return resp.json();
        });
        return Promise.race([peticion, timeout]);
    }

    /** Modo sin conexión: tasas estables por día con una pequeña variación */
    static #generarTasasSimuladas() {
        // Fecha LOCAL (toISOString usa UTC y de noche en Colombia daría el día siguiente)
        const fechaHoy = new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD
        const fechaAyer = this.#restarDias(fechaHoy, 1);
        const divisas = {};

        Object.entries(this.TASAS_REFERENCIA).forEach(([codigo, base]) => {
            const amplitud = codigo === 'BTC' ? 0.04 : 0.015; // BTC es más volátil
            const actual = base * (1 + this.#ruidoDelDia(fechaHoy + codigo) * amplitud);
            const anterior = base * (1 + this.#ruidoDelDia(fechaAyer + codigo) * amplitud);
            divisas[codigo] = this.#armarTasa(actual, anterior);
        });

        return { fecha: fechaHoy, fechaAnterior: fechaAyer, fuente: 'simulada', divisas };
    }

    static #armarTasa(actual, anterior) {
        const variacion = actual - anterior;
        const variacionPct = anterior ? (variacion / anterior) * 100 : 0;
        let tendencia = 'igual';
        if (variacionPct > 0.005) tendencia = 'sube';
        else if (variacionPct < -0.005) tendencia = 'baja';
        return { actual, anterior, variacion, variacionPct, tendencia };
    }

    /** Número "aleatorio" entre -1 y 1, pero siempre igual para la misma semilla */
    static #ruidoDelDia(semilla) {
        let hash = 0;
        for (const char of semilla) {
            hash = (hash * 31 + char.charCodeAt(0)) | 0;
        }
        return ((Math.abs(hash) % 2000) / 1000) - 1;
    }

    static #restarDias(fechaISO, dias) {
        const fecha = new Date(`${fechaISO}T12:00:00Z`);
        fecha.setUTCDate(fecha.getUTCDate() - dias);
        return fecha.toISOString().slice(0, 10);
    }

    // =====================================================================
    //  CONVERSIÓN
    // =====================================================================

    /** COP por 1 unidad de la moneda (COP = 1) */
    static tasaEnCop(moneda, tasas) {
        if (moneda === this.MONEDA_BASE) return 1;
        const tasa = tasas?.divisas?.[moneda]?.actual;
        if (!tasa) throw new Error(`No hay tasa disponible para ${moneda}`);
        return tasa;
    }

    /** Convierte pasando siempre por COP: monto × (COP/origen) ÷ (COP/destino) */
    static convertir(monto, monedaOrigen, monedaDestino, tasas) {
        if (monedaOrigen === monedaDestino) return monto;
        const enCop = monto * this.tasaEnCop(monedaOrigen, tasas);
        return enCop / this.tasaEnCop(monedaDestino, tasas);
    }

    // =====================================================================
    //  BILLETERAS (saldos en divisas) E HISTORIAL
    // =====================================================================

    static #leerTodo() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};
        } catch {
            return {};
        }
    }

    static #guardarTodo(data) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    }

    static #registroCliente(data, clienteId) {
        if (!data[clienteId]) {
            // Todas las billeteras arrancan en 0 (requisito del PO)
            data[clienteId] = { saldos: { USD: 0, EUR: 0, BTC: 0 }, historial: [] };
        }
        return data[clienteId];
    }

    static obtenerSaldos(clienteId) {
        const registro = this.#registroCliente(this.#leerTodo(), clienteId);
        return { ...registro.saldos };
    }

    static obtenerHistorial(clienteId) {
        const registro = this.#registroCliente(this.#leerTodo(), clienteId);
        return registro.historial.map((t) => Transaction.fromJSON(t));
    }

    // =====================================================================
    //  EXCHANGE
    // =====================================================================

    /**
     * Ejecuta la "compra" ficticia de divisas.
     * @param {Cliente} cliente  instancia compartida con TransactionController
     * @param {{tipo:'cuenta', numeroCuenta:string}|{tipo:'divisa', moneda:string}} origen
     * @param {{tipo:'cuenta', numeroCuenta:string}|{tipo:'divisa', moneda:string}} destino
     * @param {number} monto     expresado en la moneda de ORIGEN
     * @returns {Promise<Transaction>}
     */
    static async ejecutarExchange(cliente, { origen, destino, monto }) {
        const tasas = await this.obtenerTasas();
        // Simulamos la respuesta del "banco" (macrotarea en la cola de timers)
        await new Promise((resolve) => setTimeout(resolve, this.LATENCIA_EXCHANGE_MS));

        // ---------- 1. Validar TODO antes de modificar algo ----------
        monto = Number(monto);
        if (!monto || monto <= 0) throw new Error('El monto debe ser mayor a cero');

        const data = this.#leerTodo();
        const registro = this.#registroCliente(data, cliente.id);

        const lado = (ref) => {
            if (ref.tipo === 'cuenta') {
                const cuenta = cliente.cuentas.find((c) => c.numeroCuenta === ref.numeroCuenta);
                if (!cuenta || cuenta.tipo === 'credito') {
                    throw new Error('Selecciona una cuenta de ahorros o corriente');
                }
                return { cuenta, moneda: 'COP', etiqueta: this.etiquetaCuenta(cuenta) };
            }
            if (!this.DIVISAS[ref.moneda]) throw new Error('Divisa no soportada');
            return { moneda: ref.moneda, etiqueta: `Billetera ${ref.moneda}` };
        };

        const ladoOrigen = lado(origen);
        const ladoDestino = lado(destino);

        if (ladoOrigen.moneda === ladoDestino.moneda) {
            throw new Error('La divisa de origen y destino deben ser diferentes');
        }

        const montoOrigen = Transaction.redondear(monto, ladoOrigen.moneda);
        const disponible = ladoOrigen.cuenta
            ? ladoOrigen.cuenta.saldo
            : registro.saldos[ladoOrigen.moneda];

        if (montoOrigen > disponible + 1e-9) {
            throw new Error(`Saldo insuficiente. Disponible: ${Transaction.formatearMonto(disponible, ladoOrigen.moneda)}`);
        }

        const montoDestino = Transaction.redondear(
            this.convertir(montoOrigen, ladoOrigen.moneda, ladoDestino.moneda, tasas),
            ladoDestino.moneda
        );
        if (montoDestino <= 0) {
            throw new Error('El monto es muy pequeño para recibir algo en la divisa destino');
        }

        // ---------- 2. Aplicar los cambios ----------
        const descripcion = `Exchange ${ladoOrigen.moneda} → ${ladoDestino.moneda}`;

        if (ladoOrigen.cuenta) {
            // El exchange no usa sobregiro ni aplica el interés de retiro,
            // por eso no llamamos a retirar() sino a los auxiliares de Cuenta.
            ladoOrigen.cuenta._setSaldo(ladoOrigen.cuenta.saldo - montoOrigen);
            ladoOrigen.cuenta._registrarMovimiento(descripcion, montoOrigen);
        } else {
            registro.saldos[ladoOrigen.moneda] = Transaction.redondear(
                registro.saldos[ladoOrigen.moneda] - montoOrigen, ladoOrigen.moneda);
        }

        if (ladoDestino.cuenta) {
            ladoDestino.cuenta._setSaldo(ladoDestino.cuenta.saldo + montoDestino);
            ladoDestino.cuenta._registrarMovimiento(`${descripcion} (abono)`, montoDestino);
        } else {
            registro.saldos[ladoDestino.moneda] = Transaction.redondear(
                registro.saldos[ladoDestino.moneda] + montoDestino, ladoDestino.moneda);
        }

        const divisaDeLaTasa = ladoOrigen.moneda === 'COP' ? ladoDestino.moneda : ladoOrigen.moneda;
        const transaccion = new Transaction({
            tipo: Transaction.TIPOS.EXCHANGE,
            descripcion,
            origen: ladoOrigen.etiqueta,
            destino: ladoDestino.etiqueta,
            montoOrigen,
            monedaOrigen: ladoOrigen.moneda,
            montoDestino,
            monedaDestino: ladoDestino.moneda,
            tasa: this.tasaEnCop(divisaDeLaTasa, tasas),
            esDebito: ladoOrigen.moneda === 'COP'
        });

        // ---------- 3. Persistir ----------
        registro.historial.push(transaccion.toJSON());
        this.#guardarTodo(data);
        if (ladoOrigen.cuenta || ladoDestino.cuenta) {
            AuthService.actualizarCliente(cliente);
        }

        return transaccion;
    }

    static etiquetaCuenta(cuenta) {
        const nombres = { ahorros: 'Ahorros', corriente: 'Corriente', credito: 'Tarjeta Crédito' };
        return `${nombres[cuenta.tipo] || cuenta.tipo} • ${cuenta.numeroCuenta.replace(/\D/g, '').slice(-4)}`;
    }
}
