// js/app.js
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.toLowerCase();
    
    if (path.includes('iniciarsesion') || path.includes('login')) {
        new AuthController();
    } else if (path.includes('registro')) {
        new AuthController();
    } else if (path.includes('dashboard')) {
        const transactionController = new TransactionController();
        // Comparte el mismo cliente con el módulo de divisas
        new ExchangeController(transactionController);
    } else if (path.includes('perfil')) {
        new ProfileController();
    } else if (path.includes('admin')) {
        new AdminController();
    }
});
