// js/services/StorageService.js
/**
 * Servicio para manejar persistencia en localStorage
 */
class StorageService {
    static CLIENTES_KEY = 'mi_plata_clientes';
    static USUARIO_ACTUAL_KEY = 'mi_plata_usuario_actual';

    static guardarClientes(clientes) {
        const data = clientes.map(c => c.toJSON());
        localStorage.setItem(this.CLIENTES_KEY, JSON.stringify(data));
    }

    static obtenerClientes() {
        const data = localStorage.getItem(this.CLIENTES_KEY);
        if (!data) return [];
        
        const clientesData = JSON.parse(data);
        return clientesData.map(c => Cliente.fromJSON(c));
    }

    static guardarUsuarioActual(clienteId) {
        sessionStorage.setItem(this.USUARIO_ACTUAL_KEY, clienteId);
    }

    static obtenerUsuarioActual() {
        return sessionStorage.getItem(this.USUARIO_ACTUAL_KEY);
    }

    static cerrarSesion() {
        sessionStorage.removeItem(this.USUARIO_ACTUAL_KEY);
    }
}