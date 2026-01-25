const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const DB_CONFIG = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false,
    },
};

// Validate DB Config
if (!DB_CONFIG.host || !DB_CONFIG.password) {
    console.warn('⚠️  Warning: DB_HOST or DB_PASSWORD not set. DB connection may fail.');
}

async function seedDatabase() {
    let connection;
    try {
        console.log('🔄 Connecting to database...');
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('✅ Connected to database');

        // Get existing images from uploads folder
        const uploadsDir = path.join(__dirname, 'uploads');
        let images = [];
        if (fs.existsSync(uploadsDir)) {
            images = fs.readdirSync(uploadsDir).filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file));
        }

        // Sample products
        const sampleProducts = [
            {
                title: "Modern Lounge Chair",
                description: "Elegant and comfortable lounge chair for your living room. Features premium upholstery and solid wood legs.",
                price: 299.99,
                category: "Home & Garden",
                stock: 15,
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
                stock: 25,
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
                stock: 30,
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
                stock: 20,
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
                stock: 12,
                image: images.length > 4 ? `uploads/${images[4]}` : "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500&q=80",
                discount: 0,
                rating: 4.4,
                isFeatured: false
            },
            {
                title: "Ergonomic Office Chair",
                description: "Premium ergonomic chair with lumbar support and adjustable armrests. Perfect for long work hours.",
                price: 349.99,
                category: "Home & Garden",
                stock: 8,
                image: "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=500&q=80",
                discount: 20,
                rating: 4.9,
                isFeatured: true
            },
            {
                title: "Bluetooth Speaker",
                description: "Portable waterproof speaker with 360° sound. 12-hour battery life.",
                price: 79.99,
                category: "Electronics",
                stock: 40,
                image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&q=80",
                discount: 10,
                rating: 4.5,
                isFeatured: false
            }
        ];

        // Insert products
        console.log('🔄 Inserting products...');
        for (const product of sampleProducts) {
            await connection.query(
                `INSERT INTO Products (title, description, price, category, stock, image, discount, rating, isFeatured) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [product.title, product.description, product.price, product.category, product.stock,
                product.image, product.discount, product.rating, product.isFeatured]
            );
        }
        console.log(`✅ Inserted ${sampleProducts.length} products`);

        // Sample categories
        const sampleCategories = [
            { name: "Electronics", description: "Latest gadgets and electronic devices" },
            { name: "Home & Garden", description: "Furniture and home improvement items" },
            { name: "Fashion", description: "Clothing and accessories" },
            { name: "Sports", description: "Sports equipment and fitness gear" }
        ];

        // Insert categories
        console.log('🔄 Inserting categories...');
        for (const category of sampleCategories) {
            await connection.query(
                'INSERT INTO Categories (name, description) VALUES (?, ?)',
                [category.name, category.description]
            );
        }
        console.log(`✅ Inserted ${sampleCategories.length} categories`);

        console.log('✅ Database seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

seedDatabase();
