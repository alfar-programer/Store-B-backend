// Test script to check if security middleware loads correctly
try {
    console.log('Loading security middleware...');
    const security = require('./middleware/security');
    console.log('✅ Security middleware loaded successfully');
    console.log('Exported functions:', Object.keys(security));

    console.log('\nLoading security routes...');
    const securityRoutes = require('./routes/securityRoutes');
    console.log('✅ Security routes loaded successfully');

    console.log('\n✅ All modules loaded successfully!');
    process.exit(0);
} catch (error) {
    console.error('❌ Error loading modules:');
    console.error(error);
    process.exit(1);
}
