// js/controllers/AuthController.js
class AuthController {
    constructor() {
        this.inicializarEventListeners();
        this.cargarCorreoRecordado();
    }

    inicializarEventListeners() {
        // LOGIN
        const formLogin = document.getElementById('form-login');
        if (formLogin) {
            formLogin.addEventListener('submit', (e) => this.manejarLogin(e));
        }

        // REGISTRO
        const formRegistro = document.getElementById('form-registro');
        if (formRegistro) {
            formRegistro.addEventListener('submit', (e) => this.manejarRegistro(e));
        }

        // TOGGLE PASSWORD
        const toggleBtn = document.getElementById('toggle-password');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const input = document.getElementById('login-password');
                const icon = toggleBtn.querySelector('.material-icons');
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.textContent = 'visibility_off';
                } else {
                    input.type = 'password';
                    icon.textContent = 'visibility';
                }
            });
        }

        // RECORDAR CORREO
        const recordar = document.getElementById('recordar-correo');
        if (recordar) {
            recordar.addEventListener('change', (e) => {
                if (!e.target.checked) {
                    localStorage.removeItem('correo_recordado');
                }
            });
        }
    }

    cargarCorreoRecordado() {
        const correoGuardado = localStorage.getItem('correo_recordado');
        const inputUsuario = document.getElementById('login-usuario');
        const checkbox = document.getElementById('recordar-correo');
        
        if (correoGuardado && inputUsuario) {
            inputUsuario.value = correoGuardado;
            if (checkbox) checkbox.checked = true;
        }
    }

    manejarLogin(event) {
        event.preventDefault();
        
        const usuario = document.getElementById('login-usuario').value.trim();
        const password = document.getElementById('login-password').value;
        const recordar = document.getElementById('recordar-correo')?.checked;

        // Guardar correo si se marcó "recordar"
        if (recordar) {
            localStorage.setItem('correo_recordado', usuario);
        }

        try {
            const cliente = AuthService.login(usuario, password);
            this.mostrarMensaje('¡Bienvenido ' + cliente.nombre + '!', 'success');
            
            setTimeout(() => {
                window.location.href = 'Dashboard.html';
            }, 1000);
        } catch (error) {
            this.mostrarMensaje(error.message, 'error');
            this.actualizarContadorIntentos(usuario);
        }
    }

    manejarRegistro(event) {
        event.preventDefault();
        
        const datos = {
            identificacion: document.getElementById('reg-identificacion').value.trim(),
            nombre: document.getElementById('reg-nombre').value.trim(),
            celular: document.getElementById('reg-celular').value.trim(),
            usuario: document.getElementById('reg-usuario').value.trim(),
            password: document.getElementById('reg-password').value,
            passwordConfirm: document.getElementById('reg-password-confirm').value
        };

        // Validaciones
        if (datos.password !== datos.passwordConfirm) {
            this.mostrarMensaje('Las contraseñas no coinciden', 'error');
            return;
        }

        if (datos.password.length < 8) {
            this.mostrarMensaje('La contraseña debe tener al menos 8 caracteres', 'error');
            return;
        }

        try {
            AuthService.registrarCliente(datos);
            
            // Ocultar formulario y mostrar mensaje de éxito
            document.getElementById('form-registro').style.display = 'none';
            document.getElementById('mensaje-exito').style.display = 'block';
        } catch (error) {
            this.mostrarMensaje(error.message, 'error');
        }
    }

    actualizarContadorIntentos(usuario) {
        const clientes = StorageService.obtenerClientes();
        const cliente = clientes.find(c => c.usuario === usuario);
        const spanIntentos = document.getElementById('intentos-numero');
        
        if (cliente && spanIntentos) {
            spanIntentos.textContent = cliente.intentosLogin;
        }
    }

    mostrarMensaje(mensaje, tipo) {
        const contenedor = document.getElementById('mensaje-feedback');
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