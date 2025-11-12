import dotenv from 'dotenv';

dotenv.config();

function getEnv(key: string): string {
    const value = process.env[key];

    if(value === undefined || value === null)
        throw new Error(`환경 변수 ${key}가 설정되지 않았습니다.`);
    return value;
}

const config = {
    TWELVE_DATA_API_KEY: getEnv('TWELVE_DATA_API_KEY'),
    DATABASE_URL: getEnv('DATABASE_URL'),

    port: parseInt(process.env.PORT || '8080', 10),
}

export default config;