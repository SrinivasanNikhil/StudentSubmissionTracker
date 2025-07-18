/**
 * Password Validation Utility
 *
 * Provides comprehensive password strength validation with configurable requirements
 */

class PasswordValidator {
	constructor(options = {}) {
		this.options = {
			minLength: options.minLength || 8,
			maxLength: options.maxLength || 128,
			requireUppercase: options.requireUppercase !== false,
			requireLowercase: options.requireLowercase !== false,
			requireNumbers: options.requireNumbers !== false,
			requireSpecialChars: options.requireSpecialChars !== false,
			preventCommonPasswords: options.preventCommonPasswords !== false,
			preventSequentialChars: options.preventSequentialChars !== false,
			preventRepeatingChars: options.preventRepeatingChars !== false,
			...options,
		};
	}

	/**
	 * Validates a password against all configured requirements
	 * @param {string} password - The password to validate
	 * @returns {object} - Validation result with isValid boolean and errors array
	 */
	validate(password) {
		const errors = [];

		if (!password || typeof password !== "string") {
			return {
				isValid: false,
				errors: ["Password is required"],
				strength: "invalid",
			};
		}

		// Check minimum length
		if (password.length < this.options.minLength) {
			errors.push(
				`Password must be at least ${this.options.minLength} characters long`
			);
		}

		// Check maximum length
		if (password.length > this.options.maxLength) {
			errors.push(
				`Password must be no more than ${this.options.maxLength} characters long`
			);
		}

		// Check for uppercase letters
		if (this.options.requireUppercase && !/[A-Z]/.test(password)) {
			errors.push("Password must contain at least one uppercase letter (A-Z)");
		}

		// Check for lowercase letters
		if (this.options.requireLowercase && !/[a-z]/.test(password)) {
			errors.push("Password must contain at least one lowercase letter (a-z)");
		}

		// Check for numbers
		if (this.options.requireNumbers && !/\d/.test(password)) {
			errors.push("Password must contain at least one number (0-9)");
		}

		// Check for special characters
		if (
			this.options.requireSpecialChars &&
			!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)
		) {
			errors.push(
				"Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)"
			);
		}

		// Check for common passwords
		if (
			this.options.preventCommonPasswords &&
			this.isCommonPassword(password)
		) {
			errors.push(
				"Password is too common. Please choose a more unique password"
			);
		}

		// Check for sequential characters
		if (
			this.options.preventSequentialChars &&
			this.hasSequentialChars(password)
		) {
			errors.push(
				"Password cannot contain sequential characters (e.g., abc, 123, qwe)"
			);
		}

		// Check for repeating characters
		if (
			this.options.preventRepeatingChars &&
			this.hasRepeatingChars(password)
		) {
			errors.push(
				"Password cannot contain repeating characters (e.g., aaa, 111)"
			);
		}

		// Calculate password strength
		const strength = this.calculateStrength(password);

		return {
			isValid: errors.length === 0,
			errors,
			strength,
		};
	}

	/**
	 * Calculates password strength score (0-100)
	 * @param {string} password - The password to evaluate
	 * @returns {string} - Strength level: 'weak', 'fair', 'good', 'strong', 'very-strong'
	 */
	calculateStrength(password) {
		let score = 0;

		// Length contribution (up to 25 points)
		score += Math.min(25, password.length * 2);

		// Character variety contribution (up to 25 points)
		let variety = 0;
		if (/[a-z]/.test(password)) variety++;
		if (/[A-Z]/.test(password)) variety++;
		if (/\d/.test(password)) variety++;
		if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) variety++;
		score += variety * 6.25;

		// Complexity contribution (up to 25 points)
		const uniqueChars = new Set(password).size;
		score += Math.min(25, uniqueChars * 2);

		// Entropy contribution (up to 25 points)
		const charSet = this.getCharSet(password);
		const entropy = password.length * Math.log2(charSet);
		score += Math.min(25, entropy / 2);

		// Penalties
		if (this.isCommonPassword(password)) score -= 30;
		if (this.hasSequentialChars(password)) score -= 20;
		if (this.hasRepeatingChars(password)) score -= 15;

		score = Math.max(0, Math.min(100, score));

		// Return strength level
		if (score < 20) return "weak";
		if (score < 40) return "fair";
		if (score < 60) return "good";
		if (score < 80) return "strong";
		return "very-strong";
	}

	/**
	 * Gets the character set size for entropy calculation
	 * @param {string} password - The password to analyze
	 * @returns {number} - Character set size
	 */
	getCharSet(password) {
		let charSet = 0;
		if (/[a-z]/.test(password)) charSet += 26;
		if (/[A-Z]/.test(password)) charSet += 26;
		if (/\d/.test(password)) charSet += 10;
		if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) charSet += 32;
		return charSet || 1;
	}

	/**
	 * Checks if password is in common password list
	 * @param {string} password - The password to check
	 * @returns {boolean} - True if password is common
	 */
	isCommonPassword(password) {
		const commonPasswords = [
			"password",
			"123456",
			"123456789",
			"qwerty",
			"abc123",
			"password123",
			"admin",
			"letmein",
			"welcome",
			"monkey",
			"dragon",
			"master",
			"hello",
			"freedom",
			"whatever",
			"qazwsx",
			"trustno1",
			"jordan",
			"harley",
			"ranger",
			"iwantu",
			"jennifer",
			"hunter",
			"buster",
			"soccer",
			"baseball",
			"tiger",
			"charlie",
			"andrew",
			"michelle",
			"love",
			"sunshine",
			"jessica",
			"asshole",
			"696969",
			"amanda",
			"access",
			"yankees",
			"987654321",
			"dallas",
			"austin",
			"thunder",
			"taylor",
			"matrix",
			"mobilemail",
			"mom",
			"monitor",
			"monitoring",
			"montana",
			"moon",
			"moscow",
			"mother",
			"movie",
			"mozilla",
			"music",
			"mustang",
			"password",
			"pa$$w0rd",
			"p@ssw0rd",
			"pass123",
			"pass1234",
			"pass12345",
			"admin123",
			"root123",
			"user123",
			"test123",
			"demo123",
			"guest123",
			"welcome123",
			"login123",
			"signup123",
			"register123",
			"account123",
			"secure123",
			"safe123",
			"protect123",
			"guard123",
			"shield123",
			"defend123",
			"secure123",
			"safety123",
			"guardian123",
			"keeper123",
		];

		return commonPasswords.includes(password.toLowerCase());
	}

	/**
	 * Checks for sequential characters
	 * @param {string} password - The password to check
	 * @returns {boolean} - True if sequential characters found
	 */
	hasSequentialChars(password) {
		const sequences = [
			"abcdefghijklmnopqrstuvwxyz",
			"zyxwvutsrqponmlkjihgfedcba",
			"ABCDEFGHIJKLMNOPQRSTUVWXYZ",
			"ZYXWVUTSRQPONMLKJIHGFEDCBA",
			"0123456789",
			"9876543210",
			"qwertyuiop",
			"poiuytrewq",
			"asdfghjkl",
			"lkjhgfdsa",
			"zxcvbnm",
			"mnbvcxz",
		];

		for (const seq of sequences) {
			for (let i = 0; i <= seq.length - 3; i++) {
				const sequence = seq.substring(i, i + 3);
				if (password.toLowerCase().includes(sequence)) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Checks for repeating characters
	 * @param {string} password - The password to check
	 * @returns {boolean} - True if repeating characters found
	 */
	hasRepeatingChars(password) {
		for (let i = 0; i < password.length - 2; i++) {
			if (password[i] === password[i + 1] && password[i] === password[i + 2]) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Gets password requirements as a formatted string
	 * @returns {string} - Formatted requirements
	 */
	getRequirements() {
		const reqs = [];

		reqs.push(`At least ${this.options.minLength} characters long`);

		if (this.options.requireUppercase) {
			reqs.push("At least one uppercase letter (A-Z)");
		}

		if (this.options.requireLowercase) {
			reqs.push("At least one lowercase letter (a-z)");
		}

		if (this.options.requireNumbers) {
			reqs.push("At least one number (0-9)");
		}

		if (this.options.requireSpecialChars) {
			reqs.push("At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)");
		}

		if (this.options.preventCommonPasswords) {
			reqs.push("Cannot be a common password");
		}

		if (this.options.preventSequentialChars) {
			reqs.push("Cannot contain sequential characters (e.g., abc, 123)");
		}

		if (this.options.preventRepeatingChars) {
			reqs.push("Cannot contain repeating characters (e.g., aaa, 111)");
		}

		return reqs;
	}
}

// Create default validator instance
const defaultValidator = new PasswordValidator();

module.exports = {
	PasswordValidator,
	defaultValidator,
	validatePassword: (password) => defaultValidator.validate(password),
};
