// js/services/AuthService.js
class AuthService {
    static registrarCliente(datos) {
        const clientes = StorageService.obtenerClientes();
        
        // Validar correo único (ahora es el usuario)
        const usuarioExiste = clientes.some(c => c.usuario === datos.usuario);
        if (usuarioExiste) {
            throw new Error('Este correo ya está registrado');
        }

        // Validar documento único
        const identExiste = clientes.some(c => c.identificacion === datos.identificacion);
        if (identExiste) {
            throw new Error('Este documento ya está registrado');
        }

        // Crear cliente con los datos del nuevo formulario
        const nuevoCliente = new Cliente(
            datos.identificacion,
            datos.nombre,
            datos.celular,
            datos.usuario, // correo
            datos.password
        );

        // Crear las 3 cuentas por defecto
        nuevoCliente.agregarCuenta(new CuentaAhorros(0));
        nuevoCliente.agregarCuenta(new CuentaCorriente(0));
        nuevoCliente.agregarCuenta(new TarjetaCredito(5000000));

        clientes.push(nuevoCliente);
        StorageService.guardarClientes(clientes);

        return nuevoCliente;
    }

    static login(usuario, password) {
        const clientes = StorageService.obtenerClientes();
        const cliente = clientes.find(c => c.usuario === usuario);

        if (!cliente) {
            throw new Error('Correo no registrado en el sistema');
        }

        if (cliente.bloqueado) {
            throw new Error('Cuenta bloqueada. Contacta al administrador.');
        }

        if (!cliente.validarLogin(usuario, password)) {
            const intentosRestantes = 3 - cliente.intentosLogin;
            StorageService.guardarClientes(clientes);
            
            if (cliente.bloqueado) {
                throw new Error('Cuenta bloqueada por demasiados intentos fallidos');
            }
            
            throw new Error(`Credenciales incorrectas. Intentos restantes: ${intentosRestantes}`);
        }

        StorageService.guardarClientes(clientes);
        StorageService.guardarUsuarioActual(cliente.id);
        
        return cliente;
    }

    static obtenerClienteActual() {
        const clienteId = StorageService.obtenerUsuarioActual();
        if (!clienteId) return null;

        const clientes = StorageService.obtenerClientes();
        return clientes.find(c => c.id === clienteId);
    }

    static logout() {
        StorageService.cerrarSesion();
    }

    static actualizarCliente(clienteActualizado) {
        const clientes = StorageService.obtenerClientes();
        const index = clientes.findIndex(c => c.id === clienteActualizado.id);
        
        if (index !== -1) {
            clientes[index] = clienteActualizado;
            StorageService.guardarClientes(clientes);
        }
    }
}