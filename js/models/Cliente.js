 // js/models/Cliente.js
/**
 * Clase Cliente - Representa a un usuario del sistema bancario
 * Aplica el principio de ABSTRACCIÓN: modelamos solo los atributos
 * y métodos esenciales de un cliente bancario
 */
class Cliente {
    // Encapsulamiento: atributos privados con #
    #id;
    #identificacion;
    #nombre;
    #celular;
    #usuario;
    #password;
    #cuentas;
    #bloqueado;
    #intentosLogin;

    constructor(identificacion, nombre, celular, usuario, password) {
        this.#id = this.#generarId();
        this.#identificacion = identificacion;
        this.#nombre = nombre;
        this.#celular = celular;
        this.#usuario = usuario;
        this.#password = password;
        this.#cuentas = [];
        this.#bloqueado = false;
        this.#intentosLogin = 0;
    }

    // Getters y Setters (Encapsulamiento)
    get id() { return this.#id; }
    get identificacion() { return this.#identificacion; }
    get nombre() { return this.#nombre; }
    get celular() { return this.#celular; }
    get usuario() { return this.#usuario; }
    get cuentas() { return this.#cuentas; }
    get bloqueado() { return this.#bloqueado; }
    get intentosLogin() { return this.#intentosLogin; }

    set nombre(valor) { this.#nombre = valor; }
    set celular(valor) { this.#celular = valor; }

    // Métodos
    #generarId() {
        return 'CLI-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Validar credenciales del usuario
     * @returns {boolean} true si las credenciales son correctas
     */
    validarLogin(usuarioIngresado, passwordIngresada) {
        if (this.#bloqueado) {
            return false;
        }

        if (this.#usuario === usuarioIngresado && this.#password === passwordIngresada) {
            this.#intentosLogin = 0; // Resetear intentos si es exitoso
            return true;
        } else {
            this.#intentosLogin++;
            if (this.#intentosLogin >= 3) {
                this.#bloqueado = true;
            }
            return false;
        }
    }

    cambiarPassword(passwordActual, nuevaPassword, confirmacionPassword) {
        if (this.#password !== passwordActual) {
            throw new Error('La contraseña actual es incorrecta');
        }
        if (nuevaPassword !== confirmacionPassword) {
            throw new Error('Las contraseñas nuevas no coinciden');
        }
        this.#password = nuevaPassword;
        return true;
    }

    agregarCuenta(cuenta) {
        this.#cuentas.push(cuenta);
    }

    desbloquear() {
        this.#bloqueado = false;
        this.#intentosLogin = 0;
    }

    // Método para serializar (guardar en localStorage)
    toJSON() {
        return {
            id: this.#id,
            identificacion: this.#identificacion,
            nombre: this.#nombre,
            celular: this.#celular,
            usuario: this.#usuario,
            password: this.#password,
            cuentas: this.#cuentas.map(c => c.toJSON()),
            bloqueado: this.#bloqueado,
            intentosLogin: this.#intentosLogin
        };
    }

    // Método estático para deserializar
    static fromJSON(data) {
        const cliente = new Cliente(
            data.identificacion,
            data.nombre,
            data.celular,
            data.usuario,
            data.password
        );
        cliente.#id = data.id;
        cliente.#cuentas = data.cuentas.map(c => {
            // Reconstruir el tipo correcto de cuenta
            if (c.tipo === 'ahorros') return CuentaAhorros.fromJSON(c);
            if (c.tipo === 'corriente') return CuentaCorriente.fromJSON(c);
            if (c.tipo === 'credito') return TarjetaCredito.fromJSON(c);
        });
        cliente.#bloqueado = data.bloqueado;
        cliente.#intentosLogin = data.intentosLogin;
        return cliente;
    }

 /* Actualizar contraseña directamente (usado por admin) */
     
    actualizarPassword(nuevaPassword) {
        this.#password = nuevaPassword;
    }

}