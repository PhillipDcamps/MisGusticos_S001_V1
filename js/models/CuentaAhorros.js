// js/models/CuentaAhorros.js
/**
 * Clase CuentaAhorros - Hereda de Cuenta
 * Regla de negocio: Interés del 1.5% mensual aplicado al retirar
 */
class CuentaAhorros extends Cuenta {
    #tasaInteres;

    constructor(saldoInicial = 0) {
        super('ahorros', saldoInicial);
        this.#tasaInteres = 0.015; // 1.5% mensual
    }

    /**
     * POLIMORFISMO: Implementación específica para CuentaAhorros
     * Aplica interés del 1.5% al momento del retiro
     */
    retirar(monto) {
        if (monto <= 0) {
            throw new Error('El monto debe ser mayor a cero');
        }

        // Calcular interés generado
        const interes = this._getSaldo() * this.#tasaInteres;
        const saldoConInteres = this._getSaldo() + interes;

        // Validar que el monto no supere el saldo disponible (con interés)
        if (monto > saldoConInteres) {
            throw new Error('Saldo insuficiente. Saldo disponible: $' + saldoConInteres.toFixed(2));
        }

        // Aplicar interés y retirar
        this._setSaldo(saldoConInteres - monto);
        this._registrarMovimiento('Retiro', monto);
        
        return {
            saldoFinal: this._getSaldo(),
            interesAplicado: interes
        };
    }

    // Método adicional para consultar interés
    consultarInteres() {
        return this._getSaldo() * this.#tasaInteres;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            tasaInteres: this.#tasaInteres
        };
    }

    static fromJSON(data) {
        const cuenta = new CuentaAhorros(data.saldo);
        // Restaurar propiedades privadas usando setters o métodos internos
        return cuenta;
    }
}