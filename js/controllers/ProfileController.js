// js/controllers/ProfileController.js
class ProfileController {
    constructor() {
        this.cliente = AuthService.obtenerClienteActual();
        
        if (!this.cliente) {
            window.location.href = 'iniciarSesion.html';
            return;
        }

        this.inicializarEventListeners();
        this.cargarDatosPerfil();
    }

    inicializarEventListeners() {
        document.getElementById('btn-volver')?.addEventListener('click', () => {
            window.location.href = 'Dashboard.html';
        });
        document.getElementById('btn-logout')?.addEventListener('click', () => {
            AuthService.logout();
            window.location.href = 'iniciarSesion.html';
        });
        document.getElementById('form-editar-perfil')?.addEventListener('submit', (e) => this.editarPerfil(e));
        document.getElementById('form-cambiar-password')?.addEventListener('submit', (e) => this.cambiarPassword(e));
    }

    cargarDatosPerfil() {
        document.getElementById('perfil-nombre').value = this.cliente.nombre;
        document.getElementById('perfil-celular').value = this.cliente.celular;
        document.getElementById('perfil-identificacion').value = this.cliente.identificacion;
        document.getElementById('perfil-usuario').value = this.cliente.usuario;
    }

    editarPerfil(event) {
        event.preventDefault();
        
        this.cliente.nombre = document.getElementById('perfil-nombre').value.trim();
        this.cliente.celular = document.getElementById('perfil-celular').value.trim();
        
        AuthService.actualizarCliente(this.cliente);
        this.mostrarMensaje('Perfil actualizado correctamente', 'success');
    }

    cambiarPassword(event) {
        event.preventDefault();
        
        const passwordActual = document.getElementById('password-actual').value;
        const passwordNueva = document.getElementById('password-nueva').value;
        const passwordConfirm = document.getElementById('password-confirm').value;

        try {
            this.cliente.cambiarPassword(passwordActual, passwordNueva, passwordConfirm);
            AuthService.actualizarCliente(this.cliente);
            this.mostrarMensaje('Contraseña cambiada exitosamente', 'success');
            event.target.reset();
        } catch (error) {
            this.mostrarMensaje(error.message, 'error');
        }
    }

    mostrarMensaje(mensaje, tipo) {
        const contenedor = document.getElementById('mensaje-perfil');
        if (contenedor) {
            contenedor.textContent = mensaje;
            contenedor.className = `mensaje-feedback mensaje-${tipo}`;
            contenedor.style.display = 'block';
            
            setTimeout(() => {
                contenedor.style.display = 'none';
            }, 5000);
        }
    }
}