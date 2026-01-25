const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
});

const Product = sequelize.define('Product', {
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    category: { type: DataTypes.STRING, allowNull: false },
    image: { type: DataTypes.STRING, allowNull: false },
    discount: { type: DataTypes.INTEGER, defaultValue: 0 },
    rating: { type: DataTypes.DECIMAL(2, 1), defaultValue: 4.5 },
    isFeatured: { type: DataTypes.BOOLEAN, defaultValue: false }
});

async function checkDatabase() {
    try {
        await sequelize.authenticate();
        console.log('Database connected successfully.');

        const products = await Product.findAll();
        console.log('\n=== ALL PRODUCTS ===');
        console.log(`Total products: ${products.length}\n`);

        products.forEach((product, index) => {
            console.log(`Product ${index + 1}:`);
            console.log(`  ID: ${product.id}`);
            console.log(`  Title: ${product.title}`);
            console.log(`  Category: ${product.category}`);
            console.log(`  Price: $${product.price}`);
            console.log(`  Image: ${product.image}`);
            console.log(`  Featured: ${product.isFeatured}`);
            console.log('');
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkDatabase();
