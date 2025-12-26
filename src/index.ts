// W2M - WhatsApp to Markdown
// Entry point de la aplicación

console.log('🚀 W2M - WhatsApp to Markdown');
console.log('📅 Iniciado:', new Date().toISOString());
console.log('⏳ Esperando implementación del código base...');

// Mantener el proceso corriendo
// TODO: Implementar ingestor de WhatsApp, estrategias, etc.
process.on('SIGTERM', () => {
  console.log('🛑 Recibida señal SIGTERM, cerrando...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Recibida señal SIGINT, cerrando...');
  process.exit(0);
});

// Mantener el proceso vivo
setInterval(() => {
  // Heartbeat cada 30 segundos
  console.log('💓 Heartbeat:', new Date().toISOString());
}, 30000);

// Prevenir que el proceso termine
process.stdin.resume();

console.log('✅ W2M está corriendo. Esperando implementación...');
