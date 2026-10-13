// js/services/TransactionService.js
/**
 * Servicio para manejar transacciones bancarias
 */
class TransactionService {
    static consignar(cliente, numeroCuenta, monto) {
        const cuenta = cliente.cuentas.find(c => c.numeroCuenta === numeroCuenta);
        if (!cuenta) {
            throw new Error('Cuenta no encontrada');
        }

        cuenta.consignar(monto);
        AuthService.actualizarCliente(cliente);
        
        return {
            mensaje: 'Consignación exitosa',
            nuevoSaldo: cuenta.saldo
        };
    }

    static retirar(cliente, numeroCuenta, monto) {
        const cuenta = cliente.cuentas.find(c => c.numeroCuenta === numeroCuenta);
        if (!cuenta) {
            throw new Error('Cuenta no encontrada');
        }

        const resultado = cuenta.retirar(monto);
        AuthService.actualizarCliente(cliente);
        
        return {
            mensaje: 'Retiro exitoso',
            nuevoSaldo: resultado.saldoFinal,
            detalles: resultado
        };
    }

// js/services/TransactionService.js - Reemplazar método transferir
static transferir(cliente, cuentaOrigen, numeroCuentaDestino, monto) {
    // Validar que no sea la misma cuenta
    if (cuentaOrigen.numeroCuenta === numeroCuentaDestino) {
        throw new Error('No se puede transferir a la misma cuenta');
    }

    // Buscar cuenta destino
    const clientes = StorageService.obtenerClientes();
    let cuentaDestino = null;
    let clienteDestino = null;
    let esMismoCliente = false;

    // Buscar en cuentas del mismo cliente
    cuentaDestino = cliente.cuentas.find(c => c.numeroCuenta === numeroCuentaDestino);
    if (cuentaDestino) {
        esMismoCliente = true;
    }

    // Si no está, buscar en otros clientes
    if (!cuentaDestino) {
        for (const c of clientes) {
            cuentaDestino = c.cuentas.find(cta => cta.numeroCuenta === numeroCuentaDestino);
            if (cuentaDestino) {
                clienteDestino = c;
                break;
            }
        }
    }

    if (!cuentaDestino) {
        throw new Error('Cuenta destino no encontrada');
    }

    // RESTRICCIÓN: No permitir transferencia al mismo tipo de producto del mismo usuario
    if (esMismoCliente && cuentaOrigen.tipo === cuentaDestino.tipo) {
        throw new Error(`No se permite transferir entre cuentas del mismo tipo (${cuentaOrigen.tipo}). Debe ser entre productos diferentes.`);
    }

    // Realizar operaciones
    this.retirar(cliente, cuentaOrigen.numeroCuenta, monto);
    cuentaDestino.consignar(monto);

    if (clienteDestino) {
        AuthService.actualizarCliente(clienteDestino);
    }

    return {
        mensaje: 'Transferencia exitosa',
        saldoOrigen: cuentaOrigen.saldo,
        saldoDestino: cuentaDestino.saldo
    };
}

    static comprarConTarjeta(cliente, numeroTarjeta, monto, cuotas) {
        const tarjeta = cliente.cuentas.find(c => c.numeroCuenta === numeroTarjeta);
        if (!tarjeta || tarjeta.tipo !== 'credito') {
            throw new Error('Tarjeta no encontrada');
        }

        const resultado = tarjeta.retirar(monto, cuotas);
        AuthService.actualizarCliente(cliente);
        
        return {
            mensaje: 'Compra exitosa',
            cuotaMensual: resultado.cuotaMensual,
            tasaAplicada: resultado.tasaAplicada,
            totalPagar: resultado.totalPagar,
            cupoDisponible: tarjeta.cupoDisponible
        };
    }

    static obtenerMovimientos(cliente, numeroCuenta) {
        const cuenta = cliente.cuentas.find(c => c.numeroCuenta === numeroCuenta);
        if (!cuenta) {
            throw new Error('Cuenta no encontrada');
        }

        // Ordenar por fecha descendente
        return cuenta.movimientos.sort((a, b) => 
            new Date(b.fecha) - new Date(a.fecha)
        );
    }
}