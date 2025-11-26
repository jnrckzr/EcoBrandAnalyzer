export const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

export const validatePassword = (password) => {
    return password && password.length >= 8;
};

export const validateAge = (age) => {
    const numAge = parseInt(age);
    return !isNaN(numAge) && numAge >= 13 && numAge <= 120;
};

export const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return input.trim().replace(/[<>]/g, '');
};