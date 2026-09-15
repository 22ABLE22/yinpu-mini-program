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

/** 印章类型 */
type SealType = 'baiwen' | 'zhuwen';

/** 单流程处理阶段 */
type Stage = 'idle' | 'uploading' | 'sealing' | 'done' | 'error';

const SEAL_META: Record<SealType, { title: string; subtitle: string; badge: string; reverse: string }> = {
  baiwen: {
    title: '白文（阴刻）',
    subtitle: '红底白字 · 黑稿反色成印章',
    badge: '白文',
    reverse: '黑→白',
  },
  zhuwen: {
    title: '朱文（阳刻）',
    subtitle: '白底红字 · 黑色笔画直转为朱砂红',
    badge: '朱文',
    reverse: '黑→红',
  },
};

const STAGE_TEXT: Record<'uploading' | 'sealing', { label: string; hint: string }> = {
  uploading: { label: '正在刻章', hint: '把草稿重绘为朱砂印章' },
  sealing: { label: '正在钤印', hint: '把印章盖在米白宣纸上' },
};

/**
 * 单个印章流程的 hook
 * 状态机：idle → uploading（跑 step1）→ sealing（跑 step2）→ done / error
 */
function useSealFlow(type: SealType) {
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

      // Step 1：草稿 → 印章（带 type）
      const step1Res = await Network.uploadFile({
        url: '/api/transform/step1',
        filePath,
        name: 'file',
        formData: { type },
      });
      const step1Data = JSON.parse(step1Res.data);
      console.log(`[${type} step1]`, step1Data);
      if (step1Data?.code !== 200) {
        throw new Error(step1Data?.msg || '印章生成失败');
      }
      setStep1Url(step1Data.data.step1Url);
      setStage('sealing');

      // Step 2：印章 → 宣纸（朱文后端走色偏短路，必须带上 type）
      const step2Res = await Network.request({
        url: '/api/transform/step2',
        method: 'POST',
        data: { imageUrl: step1Data.data.step1Url, type },
      });
      const step2Data = step2Res.data;
      console.log(`[${type} step2]`, step2Data);
      if (step2Data?.code !== 200) {
        throw new Error(step2Data?.msg || '宣纸效果生成失败');
      }
      setStep2Url(step2Data.data.step2Url);
      setStage('done');
    } catch (err: any) {
      console.error(`[${type} process error]`, err);
      setErrorMsg(err?.message || '处理失败，请重试');
      setStage('error');
    }
  }, [type]);

  /** 仅重跑 step2：重新生成宣纸效果 */
  const onRetryStep2 = useCallback(async () => {
    if (!step1Url) return;
    setStage('sealing');
    setErrorMsg('');
    try {
      const step2Res = await Network.request({
        url: '/api/transform/step2',
        method: 'POST',
        data: { imageUrl: step1Url, type },
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
  }, [step1Url, type]);

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

  return {
    stage,
    errorMsg,
    draftUrl,
    step1Url,
    step2Url,
    onChoose,
    onRetryStep2,
    onSave,
    reset,
  };
}

/** 印章流程区块（白文 / 朱文），完整包含：标题 + 上传按钮 + 3 步结果 + 保存 */
const SealSection = ({ type }: { type: SealType }) => {
  const meta = SEAL_META[type];
  const flow = useSealFlow(type);
  const { stage, errorMsg, draftUrl, step1Url, step2Url } = flow;

  const isProcessing = stage === 'uploading' || stage === 'sealing';
  const hasResult =
    (stage === 'sealing' && step1Url) ||
    stage === 'done' ||
    (stage === 'error' && step1Url);
  const showFinalSkeleton = stage === 'sealing' && step1Url;

  return (
    <Card>
      <CardContent className="p-5 flex flex-col gap-4">
        {/* 板块标题 */}
        <View className="flex items-center justify-between">
          <View className="flex items-center gap-2">
            <Stamp size={20} color="#C0392B" />
            <Text
              className="block text-lg font-bold text-foreground"
              style={{ fontFamily: 'Noto Serif SC, serif' }}
            >
              {meta.title}
            </Text>
            <Badge variant="outline">{meta.badge}</Badge>
          </View>
          <Text className="block text-xs text-muted-foreground">{meta.reverse}</Text>
        </View>
        <Text className="block text-xs text-muted-foreground">{meta.subtitle}</Text>

        {/* idle 状态：上传按钮 */}
        {(stage === 'idle' || stage === 'error') && (
          <View className="flex flex-col gap-3">
            {stage === 'error' && errorMsg && (
              <View
                className="px-3 py-2 rounded-md border"
                style={{ borderColor: '#C0392B', backgroundColor: '#FBF7F0' }}
              >
                <Text className="block text-xs" style={{ color: '#C0392B' }}>{errorMsg}</Text>
              </View>
            )}
            <Button
              className="w-full"
              style={{ backgroundColor: '#C0392B', color: '#FBF7F0' }}
              onClick={flow.onChoose}
            >
              <Upload size={16} color="#FBF7F0" />
              <Text className="text-base font-medium" style={{ color: '#FBF7F0' }}>
                选择草稿
              </Text>
            </Button>
          </View>
        )}

        {/* processing 状态：进度提示 */}
        {isProcessing && (
          <View className="flex flex-col gap-3">
            <View className="flex items-center gap-2">
              <Text className="block text-sm font-semibold text-foreground">
                {STAGE_TEXT[stage as 'uploading' | 'sealing'].label}…
              </Text>
            </View>
            <Text className="block text-xs text-muted-foreground">
              {STAGE_TEXT[stage as 'uploading' | 'sealing'].hint}
            </Text>
            <Skeleton className="h-48 w-full rounded-md" />
          </View>
        )}

        {/* 结果展示：3 张图 */}
        {hasResult && (
          <View className="flex flex-col gap-3">
            {/* 草稿原图 */}
            {draftUrl && (
              <View className="flex flex-col gap-1.5">
                <View className="flex items-center gap-2">
                  <ImageIcon size={14} color="#7A7570" />
                  <Text className="block text-xs font-medium text-muted-foreground">
                    原图 · 草稿
                  </Text>
                </View>
                <Image
                  src={draftUrl}
                  mode="aspectFit"
                  className="w-full h-40 rounded-md bg-secondary"
                />
              </View>
            )}

            {/* 印章图 */}
            {step1Url && (
              <View className="flex flex-col gap-1.5">
                <View className="flex items-center gap-2">
                  <Stamp size={14} color="#C0392B" />
                  <Text className="block text-xs font-medium text-foreground">印章</Text>
                  {stage === 'sealing' && <Badge variant="secondary">刻章完成</Badge>}
                  {stage === 'done' && (
                    <Badge style={{ backgroundColor: '#C0392B', color: '#FBF7F0' }}>已生成</Badge>
                  )}
                </View>
                <Image
                  src={step1Url}
                  mode="aspectFit"
                  className="w-full h-40 rounded-md bg-card"
                />
              </View>
            )}

            {/* 宣纸效果（最终） */}
            <View className="flex flex-col gap-1.5">
              <View className="flex items-center gap-2">
                <Stamp size={14} color="#C0392B" />
                <Text className="block text-xs font-medium text-foreground">宣纸钤印</Text>
                {showFinalSkeleton && <Text className="block text-xs text-muted-foreground">钤印中…</Text>}
                {stage === 'done' && (
                  <Badge style={{ backgroundColor: '#C0392B', color: '#FBF7F0' }}>完成</Badge>
                )}
              </View>
              {showFinalSkeleton ? (
                <Skeleton className="w-full h-52 rounded-md" />
              ) : step2Url ? (
                <Image
                  src={step2Url}
                  mode="aspectFit"
                  className="w-full h-52 rounded-md bg-card"
                />
              ) : null}
            </View>
          </View>
        )}

        {/* 操作区：仅在完成时显示 */}
        {stage === 'done' && (
          <View className="flex flex-col gap-2">
            <Separator />
            <Button
              className="w-full"
              style={{ backgroundColor: '#C0392B', color: '#FBF7F0' }}
              onClick={flow.onSave}
            >
              <Download size={16} color="#FBF7F0" />
              <Text className="text-base font-medium" style={{ color: '#FBF7F0' }}>
                保存到相册
              </Text>
            </Button>
            {step1Url && (
              <Button variant="outline" className="w-full" onClick={flow.onRetryStep2}>
                <RefreshCw size={16} color="#C0392B" />
                <Text className="text-base" style={{ color: '#C0392B' }}>重新生成宣纸效果</Text>
              </Button>
            )}
            <Button variant="ghost" className="w-full" onClick={flow.reset}>
              <RotateCcw size={16} color="#7A7570" />
              <Text className="text-base text-muted-foreground">换一张草稿</Text>
            </Button>
          </View>
        )}
      </CardContent>
    </Card>
  );
};

const IndexPage = () => {
  return (
    <View className="min-h-screen w-full bg-background">
      <View className="mx-auto w-full max-w-2xl px-4 py-6 flex flex-col gap-4">
        {/* 标题区 */}
        <View className="flex flex-col items-center gap-1 py-4">
          <Text
            className="block text-3xl font-bold text-foreground"
            style={{ fontFamily: 'Noto Serif SC, serif' }}
          >
            印谱
          </Text>
          <Text
            className="block text-sm text-muted-foreground text-center"
            style={{ fontFamily: 'Noto Serif SC, serif' }}
          >
            草稿落石前，先看看盖出来的样子
          </Text>
        </View>

        {/* 板块一：白文（阴刻）·红底白字·黑稿反色 */}
        <SealSection type="baiwen" />

        {/* 板块二：朱文（阳刻）·白底红字·黑色直转朱砂 */}
        <SealSection type="zhuwen" />
      </View>
    </View>
  );
};

export default IndexPage;
