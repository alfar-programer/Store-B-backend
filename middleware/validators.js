/**
 * Input Validation Middleware
 * Validates and sanitizes user input to prevent injection attacks
 */

const { body, param, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

/**
 * User Registration Validation
 */
const validateRegistration = [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),

    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/)
        .withMessage('Password must contain uppercase, lowercase, number, and special character'),

    body('phone')
        .optional()
        .trim()
        .matches(/^[\d\s\-\+\(\)]+$/).withMessage('Invalid phone number format'),

    handleValidationErrors
];

/**
 * User Login Validation
 */
const validateLogin = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),

    body('password')
        .notEmpty().withMessage('Password is required'),

    handleValidationErrors
];

/**
 * Product Validation
 */
const validateProduct = [
    body('title')
        .trim()
        .notEmpty().withMessage('Title is required')
        .isLength({ min: 3, max: 255 }).withMessage('Title must be 3-255 characters'),

    body('description')
        .trim()
        .notEmpty().withMessage('Description is required')
        .isLength({ min: 1, max: 5000 }).withMessage('Description must be 1-5000 characters'),

    body('price')
        .notEmpty().withMessage('Price is required')
        .isFloat({ min: 0 }).withMessage('Price must be a positive number'),

    body('category')
        .trim()
        .notEmpty().withMessage('Category is required'),

    body('stock')
        .optional()
        .isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),

    body('discount')
        .optional()
        .isInt({ min: 0, max: 100 }).withMessage('Discount must be between 0 and 100'),

    body('rating')
        .optional()
        .isFloat({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5'),

    body('isFeatured')
        .optional()
        .isBoolean().withMessage('isFeatured must be a boolean'),

    handleValidationErrors
];

/**
 * Category Validation
 */
const validateCategory = [
    body('name')
        .trim()
        .notEmpty().withMessage('Category name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Category name must be 2-100 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters'),

    handleValidationErrors
];

/**
 * Order Validation
 */
const validateOrder = [
    body('customerName')
        .trim()
        .notEmpty().withMessage('Customer name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Customer name must be 2-100 characters'),

    body('total')
        .notEmpty().withMessage('Total is required')
        .isFloat({ min: 0 }).withMessage('Total must be a positive number'),

    body('items')
        .notEmpty().withMessage('Items are required')
        .isArray({ min: 1 }).withMessage('At least one item is required'),

    body('status')
        .optional()
        .isIn(['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'])
        .withMessage('Invalid order status'),

    body('shippingAddress')
        .optional(),

    handleValidationErrors
];

/**
 * ID Parameter Validation
 */
const validateId = [
    param('id')
        .isInt({ min: 1 }).withMessage('Invalid ID parameter'),

    handleValidationErrors
];

module.exports = {
    validateRegistration,
    validateLogin,
    validateProduct,
    validateCategory,
    validateOrder,
    validateId,
    handleValidationErrors
};
