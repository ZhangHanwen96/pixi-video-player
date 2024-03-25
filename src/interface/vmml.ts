import { TransitionParam } from "./animation";

/**
 * tempplate modal V4
 */
export interface VMMLTemplateV4 {
	bgColor: string;
	thumbnailSourceUrl: string;
	dimension: Dimension;
	tracks: Track[];
}

/**
 * @description 编辑timeline上下文尺寸
 */
interface Dimension {
	height: number;
	width: number;
}

interface Track {
	id: string;
	/**
     * @description 轨道类型:
        0：主轨（index为0的图片/视频轨道），
        1：画中画（其他视频轨道），
        2：文字、贴纸，
        3：音频轨道，
        4: 特效轨道
     */
	type: number;
	clips: Clip[];
}

export interface VideoTrack extends Track {
	clips: any[];
	// clips: (Clip & { videoClip: VideoClip })[];
}

export interface AudioTrack extends Track {
	clips: any[];
	// clips: (Clip & { audioClip: AudioClip })[];
}

export interface CaptionTrack extends Track {
	clips: (Clip & { textClip: TextClip })[];
}

interface Clip {
	/**
	 * @description clip类型
	 * 视频类型：100， 101：主轨，102：画中画，
	 * 文字类型：200， 201：贴纸，202：普通文字，203：识别字幕，
	 * 音频类型：300， 301：提取音频，302：音乐，303：录音，304：音效
	 * 特效类型：400：特效
	 */
	type: number;
	id: string;
	/**
     * 像素-时间素材主要包含视频素材文件、动图素材文件，单帧图像素材文件可以看作时长待定*注的像素-时间素材
        像素-时间素材文件应用在timeline中，在timeline上生成的clip会产生timeline上的起始时间inPoint与结束时间outPoint。
        随之对应的，被应用的像素-时间素材文件在原素材文件时间轴上有起始start与结束end
        这里约定：end>start outPoint>inPoint speed>0.0
        故，对任意一个非单帧像素-时间素材的恒定速率clip有：duration = (end - start) / constantSpeed = outPoint - inPoint
        
        *注
        「在上述公式定义下可得
        约定单帧像素素材 start=0 originDuration=0 constantSpeed=1.0
        单帧像素素材下，对于某一特定clip有end = outPoint - inPoint。这里的end是为推导所得约定意义时间，而非原单帧素材真的有一帧时间戳大于0。单帧像素素材中end>originDuration=0。」

        纯音频素材中定义同像素-时间素材

        原素材文件的开始时间 (μs)
     */
	start: number;
	/** 素材文件的结束时间 (μs) （单帧像素素材特有end = outPoint - inPoint） */
	end: number | number[];
	/** 在timeline上的开始时间 (μs) */
	inPoint: number;
	/** 播放时长 (μs) clip在timline上的outPoint结束时间-inPoint开始时间 */
	duration: number;
	/** 视频原本时长(μs) 单帧像素素材恒为0 */
	originDuration: number;

	audioClip?: AudioClip;
	videoClip?: VideoClip;
	textClip?: TextClip;
}

interface AudioClip {
	/** 资源url或者资源Code */
	sourceUrl: string;
	/** 音量，1.0 为正常声音，目前范围 0.0f ~ 2.0f */
	volume?: number;
	/** 变速 */
	constantSpeed?: number;
	speedToneModify?: boolean;
	volumeFadeIn?: number;
	volumeFadeOut?: number;
}

interface FilterParam {
	filterCode: "bg_blur";
	filterValue: number;
}

interface VideoClip {
	/** 资源url或者资源Code */
	sourceUrl: string;
	thumbnailSourceUrl: string;
	dimension: Dimension;
	mimeType: string;
	posParam: PositionParam;
	filterParam?: FilterParam;
	transitionParam?: TransitionParam;
	volume?: number;
}

interface PositionParam {
	centerX: number;
	centerY: number;
	centerZ: number;
	scaleX: number;
	scaleY: number;
}

interface TextClip {
	/** 文字内容（不应为空字串） */
	textContent: string;
	posParam: PositionParam;
	fontSourceUrl?: string;
	fontFamily?: string;
	dimension?: Dimension;
	/** 文字颜色ARGB 示例：#ff000000 */
	textColor?: string;
	/** 描边颜色ARGB 示例：#ff000000 */
	strokeColor?: string;
	/** 描边宽度 */
	strokeWidth?: number;
	letterSpacing?: number;
	lineSpacing?: number;
	bold?: boolean;
	italic?: boolean;
	alignType?: number;
	backgroundColor?: string;
}
