'use client';

import { motion } from 'framer-motion';

export const BenjiTypingIndicator = () => {
  return (
    <div className="flex items-center space-x-2 px-4 py-3 bg-gradient-to-r from-teal-50 to-purple-50 rounded-2xl w-fit">
      <div className="flex items-center space-x-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-teal-600 rounded-full"
            animate={{
              y: [0, -8, 0],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
      <span className="text-sm text-gray-500 ml-2">Benji is thinking...</span>
    </div>
  );
};
