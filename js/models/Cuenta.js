// js/models/Cuenta.js
/**
 * Clase Cuenta - Clase base abstracta para todos los productos bancarios
 * Aplica HERENCIA: las clases hijas heredan de esta
 */
class Cuenta {
    #numeroCuenta;
    #saldo;
    #movimientos;
    #tipo;

    constructor(tipo, saldoInicial = 0) {
        if (new.target === Cuenta) {
            throw new Error('No se puede instanciar una clase abstracta');
        }
        this.#numeroCuenta = this.#generarNumeroCuenta();
        this.#saldo = saldoInicial;
        this.#movimientos = [];
        this.#tipo = tipo;
    }

    get numeroCuenta() { return this.#numeroCuenta; }
    get saldo() { return this.#saldo; }
    get movimientos() { return this.#movimientos; }
    get tipo() { return this.#tipo; }

    #generarNumeroCuenta() {
        return 'CTA-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
    }

    /**
     * POLIMORFISMO: Cada subclase implementa su propia lógica
     * Este método debe ser sobrescrito por las clases hijas
     */
    consignar(monto) {
        if (monto <= 0) {
            throw new Error('El monto debe ser mayor a cero');
        }
        this.#saldo += monto;
        this.#registrarMovimiento('Consignación', monto);
        return this.#saldo;
    }

    /**
     * POLIMORFISMO: Método abstracto que cada subclase debe implementar
     */
    retirar(monto) {
        throw new Error('Método retirar() debe ser implementado por la subclase');
    }

    #registrarMovimiento(tipo, valor) {
        this.#movimientos.push({
            fecha: new Date().toISOString(),
            tipo: tipo,
            valor: valor
        });
    }

    // Métodos auxiliares para las subclases
    _getSaldo() { return this.#saldo; }
    _setSaldo(nuevoSaldo) { this.#saldo = nuevoSaldo; }
    _registrarMovimiento(tipo, valor) { this.#registrarMovimiento(tipo, valor); }

    toJSON() {
        return {
            numeroCuenta: this.#numeroCuenta,
            saldo: this.#saldo,
            movimientos: this.#movimientos,
            tipo: this.#tipo
        };
    }
}