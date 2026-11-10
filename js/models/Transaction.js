// js/models/Transaction.js
/**
 * Clase Transaction - Representa una transacción (exchange de divisas o
 * movimiento de una cuenta) con una estructura ÚNICA, para que la tabla de
 * "Movimientos recientes" siempre formatee los datos de la misma manera.
 *
 * Aplica ENCAPSULAMIENTO: los datos se leen por getters y el formateo
 * (moneda, fecha, signo) vive dentro del modelo, no regado por la vista.
 */
class Transaction {
    static TIPOS = Object.freeze({
        EXCHANGE: 'exchange',
        MOVIMIENTO: 'movimiento'
    });

    // Configuración de formato por divisa (decimales y símbolo)
    static FORMATO_DIVISAS = Object.freeze({
        COP: { simbolo: '$',   decimales: 2 },
        USD: { simbolo: 'US$', decimales: 2 },
        EUR: { simbolo: '€',   decimales: 2 },
        BTC: { simbolo: '₿',   decimales: 8 }
    });

    #id;
    #fecha;
    #tipo;
    #descripcion;
    #origen;
    #destino;
    #montoOrigen;
    #monedaOrigen;
    #montoDestino;
    #monedaDestino;
    #tasa;
    #esDebito;

    constructor({
        id = null,
        fecha = new Date().toISOString(),
        tipo = Transaction.TIPOS.EXCHANGE,
        descripcion = '',
        origen = '',
        destino = '',
        montoOrigen = 0,
        monedaOrigen = 'COP',
        montoDestino = null,
        monedaDestino = null,
        tasa = null,
        esDebito = false
    } = {}) {
        if (!Object.values(Transaction.TIPOS).includes(tipo)) {
            throw new Error(`Tipo de transacción inválido: ${tipo}`);
        }
        this.#id = id ?? Transaction.#generarId();
        this.#fecha = fecha;
        this.#tipo = tipo;
        this.#descripcion = descripcion;
        this.#origen = origen;
        this.#destino = destino;
        this.#montoOrigen = Number(montoOrigen);
        this.#monedaOrigen = monedaOrigen;
        this.#montoDestino = montoDestino === null ? null : Number(montoDestino);
        this.#monedaDestino = monedaDestino;
        this.#tasa = tasa === null ? null : Number(tasa);
        this.#esDebito = esDebito;
    }

    // ===== Getters =====
    get id() { return this.#id; }
    get fecha() { return this.#fecha; }
    get tipo() { return this.#tipo; }
    get descripcion() { return this.#descripcion; }
    get origen() { return this.#origen; }
    get destino() { return this.#destino; }
    get montoOrigen() { return this.#montoOrigen; }
    get monedaOrigen() { return this.#monedaOrigen; }
    get montoDestino() { return this.#montoDestino; }
    get monedaDestino() { return this.#monedaDestino; }
    get tasa() { return this.#tasa; }
    get esDebito() { return this.#esDebito; }
    get esExchange() { return this.#tipo === Transaction.TIPOS.EXCHANGE; }

    static #generarId() {
        return 'TRX-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
    }

    // ===== Formateo consistente =====

    /** Formatea un valor según la divisa: "US$ 1.234,56", "₿ 0,00012345" */
    static formatearMonto(valor, moneda = 'COP') {
        const cfg = Transaction.FORMATO_DIVISAS[moneda] || Transaction.FORMATO_DIVISAS.COP;
        const numero = Number(valor || 0).toLocaleString('es-CO', {
            minimumFractionDigits: cfg.decimales,
            maximumFractionDigits: cfg.decimales
        });
        return `${cfg.simbolo} ${numero}`;
    }

    /** Redondea hacia abajo a los decimales de la divisa (evita "crear" dinero) */
    static redondear(valor, moneda = 'COP') {
        const cfg = Transaction.FORMATO_DIVISAS[moneda] || Transaction.FORMATO_DIVISAS.COP;
        const factor = Math.pow(10, cfg.decimales);
        return Math.floor(Number(valor) * factor + 1e-9) / factor;
    }

    get fechaFormateada() {
        return new Date(this.#fecha).toLocaleString('es-CO', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    get montoOrigenFormateado() {
        return Transaction.formatearMonto(this.#montoOrigen, this.#monedaOrigen);
    }

    get montoDestinoFormateado() {
        if (this.#montoDestino === null) return '';
        return Transaction.formatearMonto(this.#montoDestino, this.#monedaDestino);
    }

    /** "1 USD = $ 4.150,00" (siempre expresado en COP por unidad de divisa) */
    get tasaFormateada() {
        if (!this.esExchange || this.#tasa === null) return '—';
        const divisa = this.#monedaOrigen === 'COP' ? this.#monedaDestino : this.#monedaOrigen;
        return `1 ${divisa} = ${Transaction.formatearMonto(this.#tasa, 'COP')}`;
    }

    // ===== Fábricas / serialización =====

    /**
     * Convierte un movimiento "crudo" de una Cuenta ({fecha, tipo, valor})
     * a una Transaction, para mostrarlo en la misma tabla que los exchanges.
     */
    static desdeMovimiento(mov, cuenta, etiquetaCuenta = '') {
        const tipoTexto = String(mov.tipo || '');
        const t = tipoTexto.toLowerCase();
        const esDebito = !t.includes('abono') &&
            (t.includes('retiro') || t.includes('compra') || t.includes('exchange'));
        return new Transaction({
            id: `MOV-${cuenta.numeroCuenta}-${mov.fecha}`,
            fecha: mov.fecha,
            tipo: Transaction.TIPOS.MOVIMIENTO,
            descripcion: tipoTexto,
            origen: etiquetaCuenta || cuenta.numeroCuenta,
            montoOrigen: mov.valor,
            monedaOrigen: 'COP',
            esDebito
        });
    }

    toJSON() {
        return {
            id: this.#id,
            fecha: this.#fecha,
            tipo: this.#tipo,
            descripcion: this.#descripcion,
            origen: this.#origen,
            destino: this.#destino,
            montoOrigen: this.#montoOrigen,
            monedaOrigen: this.#monedaOrigen,
            montoDestino: this.#montoDestino,
            monedaDestino: this.#monedaDestino,
            tasa: this.#tasa,
            esDebito: this.#esDebito
        };
    }

    static fromJSON(data) {
        return new Transaction(data);
    }
}
