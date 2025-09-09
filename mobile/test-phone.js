const formatPhoneNumber = (text) => {
  // Remove all non-digits
  const cleaned = text.replace(/\D/g, '');
  
  // Limit to 10 digits (US format)
  const match = cleaned.substring(0, 10).match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
  
  if (match) {
    const formatted = !match[2] 
      ? match[1] 
      : `(${match[1]}) ${match[2]}${match[3] ? `-${match[3]}` : ''}`;
    return formatted;
  }
  return text;
};

// Test cases
console.log('Test 1:', formatPhoneNumber('5551234567')); // Should be (555) 123-4567
console.log('Test 2:', formatPhoneNumber('555123')); // Should be (555) 123
console.log('Test 3:', formatPhoneNumber('555')); // Should be 555
console.log('Test 4:', formatPhoneNumber('55512345678901')); // Should be (555) 123-4567 (limited to 10 digits)
