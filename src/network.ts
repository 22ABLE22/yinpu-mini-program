import Taro from '@tarojs/taro'

/**
 * 网络请求模块
 * 封装 Taro.request、Taro.uploadFile、Taro.downloadFile，自动添加项目域名前缀
 * 如果请求的 url 以 http:// 或 https:// 开头，则不会添加域名前缀
 *
 * IMPORTANT: 项目已经全局注入 PROJECT_DOMAIN
 */
export namespace Network {
    // 构建时若 .env.local 未被读到，PROJECT_DOMAIN 会是空串；本地开发兜底
    const domain: string =
        typeof PROJECT_DOMAIN === 'string' && PROJECT_DOMAIN
            ? PROJECT_DOMAIN
            : 'http://localhost:3000'

    const createUrl = (url: string): string => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url
        }
        return `${domain}${url}`
    }

    // ComfyUI 本机生成可能要 2~4 分钟，微信默认 60s 会先超时
    const UPLOAD_TIMEOUT_MS = 300_000
    const REQUEST_TIMEOUT_MS = 300_000

    export const request: typeof Taro.request = option => {
        return Taro.request({
            timeout: REQUEST_TIMEOUT_MS,
            ...option,
            url: createUrl(option.url),
        })
    }

    export const uploadFile: typeof Taro.uploadFile = option => {
        return Taro.uploadFile({
            timeout: UPLOAD_TIMEOUT_MS,
            ...option,
            url: createUrl(option.url),
        })
    }

    export const downloadFile: typeof Taro.downloadFile = option => {
        return Taro.downloadFile({
            timeout: REQUEST_TIMEOUT_MS,
            ...option,
            url: createUrl(option.url),
        })
    }
}
