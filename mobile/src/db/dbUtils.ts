import { supabase } from '../lib/supabase';
import logger from '../utils/logger';

/**
 * Checks if a table exists in the database
 * @param tableName The name of the table to check
 * @returns Promise<boolean> whether the table exists
 */
export async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    // Use a direct SQL query since information_schema.tables might be restricted
    const { data, error } = await supabase.rpc('table_exists', { table_name: tableName });

    if (error) {
      logger.error(`Error checking if table ${tableName} exists:`, error);
      
      // Fallback: Try to query the table directly with limit 0
      try {
        const { error: queryError } = await supabase
          .from(tableName)
          .select('id')
          .limit(1);
          
        // If there's no error, the table exists
        return !queryError;
      } catch (fallbackError) {
        logger.error(`Fallback check for table ${tableName} failed:`, fallbackError);
        return false;
      }
    }

    return data === true;
  } catch (error) {
    logger.error(`Exception checking if table ${tableName} exists:`, error);
    return false;
  }
}

/**
 * Executes SQL statements to create necessary tables if they don't exist
 * @param sqlStatements The SQL statements to execute
 */
export async function ensureTablesExist(sqlStatements: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: sqlStatements });
    
    if (error) {
      logger.error('Error executing SQL to create tables:', error);
    } else {
      logger.info('Successfully ensured required tables exist');
    }
  } catch (error) {
    logger.error('Exception executing SQL to create tables:', error);
  }
}

/**
 * Retrieves the actual table name for a logical table name
 * This helps handle cases where the actual table name might be different
 * @param logicalTableName The table name used in code
 * @returns The actual table name in the database or the original if not found
 */
export async function getActualTableName(logicalTableName: string): Promise<string> {
  try {
    // Use RPC to get table names since direct information_schema access is restricted
    const { data, error } = await supabase.rpc('get_table_names');

    if (error) {
      logger.error(`Error getting table names:`, error);
      return logicalTableName;
    }
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return logicalTableName;
    }
    
    // Check for exact match first
    const exactMatch = data.find((name: string) => name === logicalTableName);
    if (exactMatch) return exactMatch;
    
    // Then look for similar names
    const similarNames = data.filter((name: string) => 
      name.includes(logicalTableName.replace('_', '')) || 
      logicalTableName.includes(name)
    );
    
    return similarNames.length > 0 ? similarNames[0] : logicalTableName;
  } catch (error) {
    logger.error(`Exception finding actual table name for ${logicalTableName}:`, error);
    return logicalTableName;
  }
}
