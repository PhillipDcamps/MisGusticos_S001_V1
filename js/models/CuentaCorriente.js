// js/models/CuentaCorriente.js
/**
 * Clase CuentaCorriente - Hereda de Cuenta
 * Regla de negocio: Permite sobregiro del 20%
 */
class CuentaCorriente extends Cuenta {
    #porcentajeSobregiro;

    constructor(saldoInicial = 0) {
        super('corriente', saldoInicial);
        this.#porcentajeSobregiro = 0.20; // 20% de sobregiro
    }

    /**
     * POLIMORFISMO: Implementación específica para CuentaCorriente
     * Permite retirar hasta 20% más del saldo actual
     */
    retirar(monto) {
        if (monto <= 0) {
            throw new Error('El monto debe ser mayor a cero');
        }

        const saldoActual = this._getSaldo();
        const limiteRetiro = saldoActual + (saldoActual * this.#porcentajeSobregiro);

        if (monto > limiteRetiro) {
            throw new Error(`Saldo insuficiente. Límite de retiro: $${limiteRetiro.toFixed(2)}`);
        }

        this._setSaldo(saldoActual - monto);
        this._registrarMovimiento('Retiro', monto);
        
        return {
            saldoFinal: this._getSaldo(),
            sobregiroUtilizado: monto > saldoActual ? monto - saldoActual : 0
        };
    }

    consultarLimiteRetiro() {
        const saldoActual = this._getSaldo();
        return saldoActual + (saldoActual * this.#porcentajeSobregiro);
    }

    toJSON() {
        return {
            ...super.toJSON(),
            porcentajeSobregiro: this.#porcentajeSobregiro
        };
    }

    static fromJSON(data) {
        const cuenta = new CuentaCorriente(data.saldo);
        return cuenta;
    }
}