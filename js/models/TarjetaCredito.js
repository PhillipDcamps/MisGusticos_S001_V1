// js/models/TarjetaCredito.js
/**
 * Clase TarjetaCredito - Hereda de Cuenta
 * Regla de negocio: Financiamiento a cuotas con tasas variables
 */
class TarjetaCredito extends Cuenta {
    #cupoTotal;
    #cupoDisponible;
    #compras;

    constructor(cupoTotal) {
        super('credito', 0);
        this.#cupoTotal = cupoTotal;
        this.#cupoDisponible = cupoTotal;
        this.#compras = [];
    }

    get cupoTotal() { return this.#cupoTotal; }
    get cupoDisponible() { return this.#cupoDisponible; }
    get compras() { return this.#compras; }

    /**
     * POLIMORFISMO: En tarjeta de crédito, "retirar" es comprar a cuotas
     */
    retirar(monto, cuotas) {
        if (monto <= 0) {
            throw new Error('El monto debe ser mayor a cero');
        }
        if (monto > this.#cupoDisponible) {
            throw new Error('Cupo insuficiente. Cupo disponible: $' + this.#cupoDisponible);
        }
        if (cuotas < 1) {
            throw new Error('El número de cuotas debe ser al menos 1');
        }

        // Determinar tasa de interés según cuotas
        const tasa = this.#obtenerTasaInteres(cuotas);
        
        // Calcular cuota mensual usando fórmula de amortización
        const cuotaMensual = this.#calcularCuota(monto, tasa, cuotas);
        
        // Registrar compra
        const compra = {
            id: 'COMP-' + Date.now(),
            monto: monto,
            cuotas: cuotas,
            tasa: tasa,
            cuotaMensual: cuotaMensual,
            fecha: new Date().toISOString(),
            saldoPendiente: monto
        };
        
        this.#compras.push(compra);
        this.#cupoDisponible -= monto;
        this._registrarMovimiento(`Compra a ${cuotas} cuotas`, monto);

        return {
            cuotaMensual: cuotaMensual,
            tasaAplicada: tasa,
            totalPagar: cuotaMensual * cuotas
        };
    }

    #obtenerTasaInteres(cuotas) {
        if (cuotas <= 2) return 0;           // 0%
        if (cuotas <= 6) return 0.019;       // 1.9%
        return 0.023;                        // 2.3%
    }

    #calcularCuota(capital, tasa, n) {
        if (tasa === 0) {
            return capital / n; // Sin interés
        }
        // Fórmula: Cuota = (Capital × tasa) / (1 − (1 + tasa)^(-n))
        const cuota = (capital * tasa) / (1 - Math.pow(1 + tasa, -n));
        return cuota;
    }

    consultarSaldo() {
        return this.#cupoDisponible;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            cupoTotal: this.#cupoTotal,
            cupoDisponible: this.#cupoDisponible,
            compras: this.#compras
        };
    }

    static fromJSON(data) {
        const tarjeta = new TarjetaCredito(data.cupoTotal);
        return tarjeta;
    }
}