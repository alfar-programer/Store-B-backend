const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const fs = require('fs');

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

async function seedDatabase() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');
        await sequelize.sync({ force: true }); // Recreate tables
        console.log('Tables created.');

        // Get existing images from uploads folder
        const uploadsDir = path.join(__dirname, 'uploads');
        let images = [];
        if (fs.existsSync(uploadsDir)) {
            images = fs.readdirSync(uploadsDir).filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file));
        }

        const sampleProducts = [
            {
                title: "Modern Lounge Chair",
                description: "Elegant and comfortable lounge chair for your living room. Features premium upholstery and solid wood legs.",
                price: 299.99,
                category: "Home & Garden",
                image: images.length > 0 ? `uploads/${images[0]}` : "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=500&q=80",
                discount: 10,
                rating: 4.8,
                isFeatured: true
            },
            {
                title: "Wireless Noise-Canceling Headphones",
                description: "Immerse yourself in music with these top-tier noise-canceling headphones. 30-hour battery life.",
                price: 199.50,
                category: "Electronics",
                image: images.length > 1 ? `uploads/${images[1]}` : "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80",
                discount: 0,
                rating: 4.7,
                isFeatured: true
            },
            {
                title: "Minimalist Desk Lamp",
                description: "Sleek LED desk lamp with adjustable brightness and color temperature. Perfect for your home office.",
                price: 45.00,
                category: "Home & Garden",
                image: images.length > 2 ? `uploads/${images[2]}` : "https://images.unsplash.com/photo-1507473888900-52e1adad5474?w=500&q=80",
                discount: 5,
                rating: 4.5,
                isFeatured: false
            },
            {
                title: "Smart Fitness Watch",
                description: "Track your workouts, heart rate, and sleep with this advanced fitness tracker. Water-resistant.",
                price: 129.99,
                category: "Electronics",
                image: images.length > 3 ? `uploads/${images[3]}` : "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80",
                discount: 15,
                rating: 4.6,
                isFeatured: true
            },
            {
                title: "Premium Coffee Maker",
                description: "Brew the perfect cup of coffee every morning. Programmable timer and thermal carafe.",
                price: 89.95,
                category: "Home & Garden",
                image: images.length > 4 ? `uploads/${images[4]}` : "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500&q=80",
                discount: 0,
                rating: 4.4,
                isFeatured: false
            }
        ];

        await Product.bulkCreate(sampleProducts);
        console.log('Database seeded successfully with 5 products.');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();
