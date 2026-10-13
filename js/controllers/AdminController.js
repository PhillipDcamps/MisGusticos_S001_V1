// js/controllers/AdminController.js
/**
 * Controlador para administrar usuarios (CRUD)
 */
class AdminController {
    constructor() {
        this.clienteActual = AuthService.obtenerClienteActual();
        
        if (!this.clienteActual) {
            window.location.href = 'iniciarSesion.html';
            return;
        }

        this.inicializarEventListeners();
        this.cargarUsuarios();
    }

    inicializarEventListeners() {
        // Botones de navegación
        document.getElementById('btn-volver-dashboard')?.addEventListener('click', () => {
            window.location.href = 'Dashboard.html';
        });
        document.getElementById('btn-logout')?.addEventListener('click', () => {
            AuthService.logout();
            window.location.href = 'iniciarSesion.html';
        });

        // Nuevo usuario
        document.getElementById('btn-nuevo-usuario')?.addEventListener('click', () => {
            this.abrirModalNuevo();
        });

        // Cerrar modal
        document.querySelectorAll('[data-close="modal-usuario"]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('modal-usuario').style.display = 'none';
            });
        });

        // Guardar usuario (crear o editar)
        document.getElementById('form-usuario')?.addEventListener('submit', (e) => {
            this.guardarUsuario(e);
        });
    }

    cargarUsuarios() {
        const clientes = StorageService.obtenerClientes();
        const tbody = document.getElementById('body-tabla-usuarios');
        
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        clientes.forEach(cliente => {
            const fila = document.createElement('tr');
            fila.innerHTML = `
                <td>${cliente.nombre}</td>
                <td>${cliente.identificacion}</td>
                <td>${cliente.usuario}</td>
                <td>${cliente.celular}</td>
                <td>
                    <span class="badge ${cliente.bloqueado ? 'badge-danger' : 'badge-success'}">
                        ${cliente.bloqueado ? 'Bloqueado' : 'Activo'}
                    </span>
                </td>
                <td class="actions-cell">
                    <button class="btn-icon btn-edit" data-id="${cliente.id}" title="Editar">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="btn-icon btn-delete" data-id="${cliente.id}" title="Eliminar">
                        <span class="material-icons">delete</span>
                    </button>
                    ${cliente.bloqueado ? `
                        <button class="btn-icon btn-unlock" data-id="${cliente.id}" title="Desbloquear">
                            <span class="material-icons">lock_open</span>
                        </button>
                    ` : ''}
                </td>
            `;
            tbody.appendChild(fila);
        });

        // Asignar eventos a botones de acción
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.abrirModalEditar(id);
            });
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.eliminarUsuario(id);
            });
        });

        document.querySelectorAll('.btn-unlock').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.desbloquearUsuario(id);
            });
        });
    }

    abrirModalNuevo() {
        document.getElementById('titulo-modal-usuario').textContent = 'Nuevo Usuario';
        document.getElementById('form-usuario').reset();
        document.getElementById('usuario-id').value = '';
        document.getElementById('usu-password').required = true;
        document.getElementById('hint-password').style.display = 'none';
        document.getElementById('modal-usuario').style.display = 'flex';
    }

    abrirModalEditar(id) {
        const clientes = StorageService.obtenerClientes();
        const cliente = clientes.find(c => c.id === id);
        
        if (!cliente) {
            this.mostrarMensaje('Usuario no encontrado', 'error');
            return;
        }

        document.getElementById('titulo-modal-usuario').textContent = 'Editar Usuario';
        document.getElementById('usuario-id').value = cliente.id;
        document.getElementById('usu-nombre').value = cliente.nombre;
        document.getElementById('usu-identificacion').value = cliente.identificacion;
        document.getElementById('usu-celular').value = cliente.celular;
        document.getElementById('usu-correo').value = cliente.usuario;
        document.getElementById('usu-password').value = '';
        document.getElementById('usu-password').required = false;
        document.getElementById('hint-password').style.display = 'block';
        document.getElementById('modal-usuario').style.display = 'flex';
    }

    guardarUsuario(event) {
        event.preventDefault();
        
        const id = document.getElementById('usuario-id').value;
        const datos = {
            nombre: document.getElementById('usu-nombre').value.trim(),
            identificacion: document.getElementById('usu-identificacion').value.trim(),
            celular: document.getElementById('usu-celular').value.trim(),
            correo: document.getElementById('usu-correo').value.trim(),
            password: document.getElementById('usu-password').value
        };

        try {
            if (id) {
                // EDITAR
                this.editarUsuario(id, datos);
            } else {
                // CREAR
                this.crearUsuario(datos);
            }
            
            document.getElementById('modal-usuario').style.display = 'none';
            this.cargarUsuarios();
        } catch (error) {
            this.mostrarMensaje(error.message, 'error');
        }
    }

    crearUsuario(datos) {
        if (!datos.password || datos.password.length < 8) {
            throw new Error('La contraseña debe tener al menos 8 caracteres');
        }

        AuthService.registrarCliente({
            identificacion: datos.identificacion,
            nombre: datos.nombre,
            celular: datos.celular,
            usuario: datos.correo,
            password: datos.password
        });

        this.mostrarMensaje('Usuario creado exitosamente', 'success');
    }

    editarUsuario(id, datos) {
        const clientes = StorageService.obtenerClientes();
        const cliente = clientes.find(c => c.id === id);
        
        if (!cliente) {
            throw new Error('Usuario no encontrado');
        }

        // Validar que el correo no esté en uso por otro
        const correoEnUso = clientes.some(c => c.usuario === datos.correo && c.id !== id);
        if (correoEnUso) {
            throw new Error('Ese correo ya está registrado');
        }

        // Actualizar datos
        cliente.nombre = datos.nombre;
        cliente.celular = datos.celular;
        
        // Actualizar contraseña solo si se proporcionó
        if (datos.password && datos.password.length > 0) {
            // Accedemos directamente al atributo privado mediante un setter especial
            cliente.actualizarPassword(datos.password);
        }

        AuthService.actualizarCliente(cliente);
        this.mostrarMensaje('Usuario actualizado exitosamente', 'success');
    }

    eliminarUsuario(id) {
        if (id === this.clienteActual.id) {
            this.mostrarMensaje('No puedes eliminar tu propia cuenta', 'error');
            return;
        }

        if (!confirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.')) {
            return;
        }

        AuthService.eliminarCliente(id);
        this.mostrarMensaje('Usuario eliminado correctamente', 'success');
        this.cargarUsuarios();
    }

    desbloquearUsuario(id) {
        const clientes = StorageService.obtenerClientes();
        const cliente = clientes.find(c => c.id === id);
        
        if (cliente) {
            cliente.desbloquear();
            AuthService.actualizarCliente(cliente);
            this.mostrarMensaje('Usuario desbloqueado', 'success');
            this.cargarUsuarios();
        }
    }

    mostrarMensaje(mensaje, tipo) {
        const contenedor = document.getElementById('mensaje-admin');
        if (contenedor) {
            contenedor.textContent = mensaje;
            contenedor.className = `mensaje-feedback mensaje-${tipo}`;
            contenedor.style.display = 'block';
            
            setTimeout(() => {
                contenedor.style.display = 'none';
            }, 4000);
        }
    }
}