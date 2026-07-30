import { View, Text, Image } from '@tarojs/components';
import { useState, useCallback } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Upload, Stamp, Image as ImageIcon, RefreshCw, Download, RotateCcw } from 'lucide-react-taro';
import './index.css';

/** 处理阶段 */
type Stage = 'idle' | 'uploading' | 'sealing' | 'done' | 'error';

const STAGE_TEXT: Record<'uploading' | 'sealing', { label: string; hint: string }> = {
  uploading: { label: '正在刻章', hint: '把草稿重绘为朱砂印章' },
  sealing: { label: '正在钤印', hint: '把印章盖在米白宣纸上' },
};

const IndexPage = () => {
  const [stage, setStage] = useState<Stage>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [draftUrl, setDraftUrl] = useState('');
  const [step1Url, setStep1Url] = useState('');
  const [step2Url, setStep2Url] = useState('');

  /** 重置全部状态 */
  const reset = useCallback(() => {
    setStage('idle');
    setErrorMsg('');
    setDraftUrl('');
    setStep1Url('');
    setStep2Url('');
  }, []);

  /** 选择图片 + 跑两步 */
  const onChoose = useCallback(async () => {
    try {
      const res = await Taro.chooseImage({
        count: 1,
        sizeType: ['original', 'compressed'],
        sourceType: ['album', 'camera'],
      });
      const filePath = res.tempFilePaths[0];
      if (!filePath) return;

      setDraftUrl(filePath);
      setStage('uploading');
      setErrorMsg('');

      // Step 1：草稿 → 印章
      const step1Res = await Network.uploadFile({
        url: '/api/transform/step1',
        filePath,
        name: 'file',
      });
      const step1Data = JSON.parse(step1Res.data);
      console.log('[step1 response]', step1Data);
      if (step1Data?.code !== 200) {
        throw new Error(step1Data?.msg || '印章生成失败');
      }
      setStep1Url(step1Data.data.step1Url);
      setStage('sealing');

      // Step 2：印章 → 宣纸
      const step2Res = await Network.request({
        url: '/api/transform/step2',
        method: 'POST',
        data: { imageUrl: step1Data.data.step1Url },
      });
      const step2Data = step2Res.data;
      console.log('[step2 response]', step2Data);
      if (step2Data?.code !== 200) {
        throw new Error(step2Data?.msg || '宣纸效果生成失败');
      }
      setStep2Url(step2Data.data.step2Url);
      setStage('done');
    } catch (err: any) {
      console.error('[process error]', err);
      setErrorMsg(err?.message || '处理失败，请重试');
      setStage('error');
    }
  }, []);

  /** 仅跑 step2：用户对 step1 印章满意后想重新生成宣纸效果 */
  const onRetryStep2 = useCallback(async () => {
    if (!step1Url) return;
    setStage('sealing');
    setErrorMsg('');
    try {
      const step2Res = await Network.request({
        url: '/api/transform/step2',
        method: 'POST',
        data: { imageUrl: step1Url },
      });
      const step2Data = step2Res.data;
      if (step2Data?.code !== 200) {
        throw new Error(step2Data?.msg || '宣纸效果生成失败');
      }
      setStep2Url(step2Data.data.step2Url);
      setStage('done');
    } catch (err: any) {
      setErrorMsg(err?.message || '处理失败，请重试');
      setStage('error');
    }
  }, [step1Url]);

  /** 保存最终图到相册 */
  const onSave = useCallback(async () => {
    if (!step2Url) return;
    try {
      const dl = await Network.downloadFile({ url: step2Url });
      await Taro.saveImageToPhotosAlbum({ filePath: dl.tempFilePath });
      Taro.showToast({ title: '已保存到相册', icon: 'success' });
    } catch (err: any) {
      Taro.showToast({ title: err?.errMsg || '保存失败', icon: 'none' });
    }
  }, [step2Url]);

  const isProcessing = stage === 'uploading' || stage === 'sealing';
  const hasResult = (stage === 'sealing' && step1Url) || stage === 'done' || (stage === 'error' && step1Url);
  const showFinalSkeleton = stage === 'sealing' && step1Url;

  return (
    <View className="min-h-screen w-full bg-background">
      <View className="mx-auto w-full max-w-2xl px-4 py-6 flex flex-col gap-4">
        {/* 标题区 */}
        <View className="flex flex-col items-center gap-1 py-4">
          <Text className="block text-3xl font-bold text-foreground" style={{ fontFamily: 'Noto Serif SC, serif' }}>
            印谱
          </Text>
          <Text className="block text-sm text-muted-foreground" style={{ fontFamily: 'Noto Serif SC, serif' }}>
            草稿落石前，先看看盖出来的样子
          </Text>
        </View>

        {/* 上传区（idle / error 状态显示） */}
        {(stage === 'idle' || stage === 'error') && (
          <Card>
            <CardContent className="p-6 flex flex-col items-center gap-3">
              <View className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                <Upload size={28} color="#C0392B" />
              </View>
              <Text className="block text-base text-foreground font-medium">
                上传印章设计稿
              </Text>
              <Text className="block text-xs text-muted-foreground text-center">
                支持相册选择或拍照 · 处理约需 1-2 分钟
              </Text>
              {stage === 'error' && errorMsg && (
                <Text className="block text-sm text-destructive text-center">{errorMsg}</Text>
              )}
              <Button
                className="w-full mt-2"
                style={{ backgroundColor: '#C0392B', color: '#FBF7F0' }}
                onClick={onChoose}
              >
                <Upload size={16} color="#FBF7F0" />
                <Text className="text-base font-medium" style={{ color: '#FBF7F0' }}>
                  选择草稿
                </Text>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 进度区（处理中） */}
        {isProcessing && (
          <Card>
            <CardContent className="p-6 flex flex-col gap-4">
              <View className="flex items-center gap-2">
                <Stamp size={20} color="#C0392B" />
                <Text className="block text-base font-semibold text-foreground">
                  {STAGE_TEXT[stage as 'uploading' | 'sealing'].label}
                </Text>
              </View>
              <Text className="block text-xs text-muted-foreground">
                {STAGE_TEXT[stage as 'uploading' | 'sealing'].hint}
              </Text>
              <Skeleton className="h-48 w-full rounded-md" />
            </CardContent>
          </Card>
        )}

        {/* 结果展示区（step1 已完成 / 全部完成） */}
        {hasResult && (
          <View className="flex flex-col gap-4">
            {/* 草稿原图 */}
            {draftUrl && (
              <Card>
                <CardContent className="p-4 flex flex-col gap-2">
                  <View className="flex items-center gap-2">
                    <ImageIcon size={16} color="#7A7570" />
                    <Text className="block text-sm font-medium text-muted-foreground">原图 · 草稿</Text>
                  </View>
                  <Image
                    src={draftUrl}
                    mode="aspectFit"
                    className="w-full h-48 rounded-md bg-card"
                  />
                </CardContent>
              </Card>
            )}

            {/* 印章图 */}
            {step1Url && (
              <Card>
                <CardContent className="p-4 flex flex-col gap-2">
                  <View className="flex items-center justify-between">
                    <View className="flex items-center gap-2">
                      <Stamp size={16} color="#C0392B" />
                      <Text className="block text-sm font-medium text-foreground">印章</Text>
                      {stage === 'sealing' && <Badge variant="secondary">刻章完成</Badge>}
                      {stage === 'done' && <Badge style={{ backgroundColor: '#C0392B', color: '#FBF7F0' }}>已生成</Badge>}
                    </View>
                  </View>
                  <Image
                    src={step1Url}
                    mode="aspectFit"
                    className="w-full h-48 rounded-md bg-card"
                  />
                </CardContent>
              </Card>
            )}

            {/* 宣纸效果（最终） */}
            <Card>
              <CardContent className="p-4 flex flex-col gap-2">
                <View className="flex items-center justify-between">
                  <View className="flex items-center gap-2">
                    <Stamp size={16} color="#C0392B" />
                    <Text className="block text-sm font-medium text-foreground">宣纸钤印</Text>
                    {showFinalSkeleton && <Text className="block text-xs text-muted-foreground">钤印中…</Text>}
                    {stage === 'done' && <Badge style={{ backgroundColor: '#C0392B', color: '#FBF7F0' }}>完成</Badge>}
                  </View>
                </View>
                {showFinalSkeleton ? (
                  <Skeleton className="w-full h-60 rounded-md" />
                ) : step2Url ? (
                  <Image
                    src={step2Url}
                    mode="aspectFit"
                    className="w-full h-60 rounded-md bg-card"
                  />
                ) : null}
              </CardContent>
            </Card>

            {/* 错误提示 */}
            {stage === 'error' && errorMsg && (
              <View className="px-4 py-2 rounded-md border" style={{ borderColor: '#C0392B', backgroundColor: '#FBF7F0' }}>
                <Text className="block text-sm" style={{ color: '#C0392B' }}>{errorMsg}</Text>
              </View>
            )}

            {/* 操作区 */}
            <Separator />
            <View className="flex flex-col gap-3 pb-4">
              {stage === 'done' && (
                <Button
                  className="w-full"
                  style={{ backgroundColor: '#C0392B', color: '#FBF7F0' }}
                  onClick={onSave}
                >
                  <Download size={16} color="#FBF7F0" />
                  <Text className="text-base font-medium" style={{ color: '#FBF7F0' }}>保存到相册</Text>
                </Button>
              )}
              {stage === 'done' && step1Url && (
                <Button variant="outline" className="w-full" onClick={onRetryStep2}>
                  <RefreshCw size={16} color="#C0392B" />
                  <Text className="text-base" style={{ color: '#C0392B' }}>重新生成宣纸效果</Text>
                </Button>
              )}
              <Button variant="ghost" className="w-full" onClick={reset}>
                <RotateCcw size={16} color="#7A7570" />
                <Text className="text-base text-muted-foreground">重新开始</Text>
              </Button>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

export default IndexPage;
