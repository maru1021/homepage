//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@HDR�������ۂ��t�B���^ v0.1
//�@�@�@by ��������iuser/5145841�j
//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@���[�U�[�p�����[�^

//�@�񓧉߃��[�h�i 0: ���������͂��̂܂܏o�́A1: ���������𔒔w�i�Ƃ��ďo�́j
#define NON_TRANSPARENT 0

//�@���m�N�����A���S���Y���w��
//�@�@1:���ώZ�o�@�@2:BT.601(NTSC)�x�[�X�@3:BT.709(HDTV)�x�[�X�i�f�t�H���g�j
#define MONO_ALGO 3
//�@BT.709�x�[�X�Ń��m�N��������ۂɗp����K���}�l�i��{: 2.2�A�����l�͈�: 1.0 �` 5.0�j
#define GAMMA 2.2

//�@�ȈՐF���␳�i ��, ��, �i,���j�̏��Ɏw��A1�ŕω��Ȃ��j
//�@�@�����ݒ� 1.0, 1.0, 1.0, 1.0
float4 ColorFilter
<
   string UIName = "ColorFilter";
   string UIWidget = "Color";
   bool UIVisible =  true;
   float UIMin = float4( 0, 0, 0, 1);
   float UIMax = float4( 2, 2, 2, 1);
> = float4( 1.0, 1.0, 1.0, 1.0 );


//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@������`

//�@�����_�����O�^�[�Q�b�g�̃N���A�l
#if NON_TRANSPARENT
float4 ClearColor = {1,1,1,1};
#else
float4 ClearColor = {0.5,0.5,0.5,0};
#endif
float ClearDepth  = 1.0;

//�@�|�X�g�G�t�F�N�g�錾
float Script : STANDARDSGLOBAL <
	string ScriptOutput = "color";
	string ScriptClass = "scene";
	string ScriptOrder = "postprocess";
> = 0.8;

//�@�X�N���[���T�C�Y
float2 ViewportSize : VIEWPORTPIXELSIZE;
static float2 ViewportOffset = (float2(0.5,0.5)/ViewportSize);

//�@�A�N�Z�T������ݒ�l���擾
float4 MaterialDiffuse : DIFFUSE  < string Object = "Geometry"; >;
static float alpha = MaterialDiffuse.a;

float scaling0 : CONTROLOBJECT < string name = "(self)"; >;
static float scaling = scaling0 * 0.1;

float3 ObjXYZ0 : CONTROLOBJECT < string name = "(self)"; >;
static float3 ObjXYZ = ObjXYZ0 + 1.0;

//�@�[�x�o�b�t�@
texture2D DepthBuffer : RENDERDEPTHSTENCILTARGET <
	float2 ViewPortRatio = {1.0,1.0};
	string Format = "D24S8";
>;

//�@�I���W�i���̕`�挋�ʂ��L�^���邽�߂̃����_�[�^�[�Q�b�g
texture2D ScnMap : RENDERCOLORTARGET <
	float2 ViewPortRatio = {1.0,1.0};
	int MipLevels = 1;
	string Format = "A8R8G8B8" ;
>;
sampler2D ScnSamp = sampler_state {
	texture = <ScnMap>;
	MinFilter = NONE;
	MagFilter = NONE;
	MipFilter = NONE;
	AddressU  = CLAMP;
	AddressV = CLAMP;
};

//�@�Ŗ��x���L�^���邽�߂̃����_�[�^�[�Q�b�g
texture2D HighColorMap : RENDERCOLORTARGET <
	float4 ClearColor = {0,0,0,1};
	int Width = 1;
	int Height = 1;
	string Format = "X8R8G8B8" ;
>;
sampler2D HighColorSamp = sampler_state {
	texture = <HighColorMap>;
	MinFilter = NONE;
	MagFilter = NONE;
	MipFilter = NONE;
	AddressU  = CLAMP;
	AddressV = CLAMP;
};

//�@�ňÓx���L�^���邽�߂̃����_�[�^�[�Q�b�g
texture2D LowColorMap : RENDERCOLORTARGET <
	float4 ClearColor = {1,1,1,1};
	int Width = 1;
	int Height = 1;
	int MipLevels = 1;
	string Format = "A8R8G8B8" ;
>;
sampler2D LowColorSamp = sampler_state {
	texture = <LowColorMap>;
	MinFilter = NONE;
	MagFilter = NONE;
	MipFilter = NONE;
	AddressU  = CLAMP;
	AddressV = CLAMP;
};

#if MONO_ALGO == 2	//�@�P�x�Z�o�@�iBT601:NTSC�j
static const float3 LumiFactor = {0.29891, 0.58661, 0.11448};

#elif MONO_ALGO == 3	//�@�P�x�Z�o�@�iBT709:HDTV�j
static const float3 LumiFactor = {0.2126, 0.7152, 0.0722};
#endif
	
//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@���_�V�F�[�_
struct VS_OUTPUT {
	float4 Pos			: POSITION;
	float2 Tex			: TEXCOORD0;
};

VS_OUTPUT VS_passDraw( float4 Pos : POSITION, float4 Tex : TEXCOORD0 )
{
	VS_OUTPUT Out = (VS_OUTPUT)0; 
	
	Out.Pos = Pos;
	Out.Tex = Tex + ViewportOffset;
	
	return Out;
}

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@�v���Z�b�g�r�b�g�}�b�v�����ɐF�̒u������

float4 PS_passAutoTone(float2 Tex: TEXCOORD0) : COLOR
{   
	float4 Color = tex2D( ScnSamp, Tex );		//�@������̃s�N�Z���J���[���i�[
	float4 ColorOrg = Color;	//�@�����O�̃s�N�Z���J���[���i�[
	
	#if MONO_ALGO == 1		//�@���ώZ�o�@
		float3 negativeGray = 1.0 - dot(Color.rgb, 0.3333333);

	#elif MONO_ALGO == 2	//�@�P�x�Z�o�@�iBT601:NTSC�j
		float3 negativeGray = 1.0 - dot(LumiFactor, Color.rgb);

	#else					//�@�P�x�Z�o�@�iBT709:HDTV�j
		float3 negativeGray = pow(Color.rgb, GAMMA);
		negativeGray = 1.0 - pow(dot(LumiFactor, negativeGray.rgb), 1.0 / GAMMA);
	#endif
	
	//�@�I�[�o�[���C����
	Color.rgb = ColorOrg.rgb < 0.5 ? ColorOrg.rgb * negativeGray * 2.0
									: 1.0 - 2.0 * (1.0 - ColorOrg.rgb) * (1.0 - negativeGray);

	//	�\�t�g���C�g����
	Color.rgb = ColorOrg.rgb < 0.5 ? pow(Color.rgb, 2.0 * (1.0 - ColorOrg.rgb))
									: pow(Color.rgb, 1.0 / (2.0 * ColorOrg.rgb));

	//�@�F���␳�ʂ��Â��ɔ�Ⴓ���č���
    Color.rgb = lerp(Color.rgb * ColorFilter.rgb * ObjXYZ, Color.rgb, Color.rgb);

	//�@�A�N�Z�T���̕s�����x�����ɃI���W�i���ƍ���
	return lerp(ColorOrg, Color, alpha);
}

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
technique AutoTone <
	string Script = 
		
		"RenderColorTarget0=ScnMap;"
		"RenderDepthStencilTarget=DepthBuffer;"
		"ClearSetColor=ClearColor;"
		"ClearSetDepth=ClearDepth;"
		"Clear=Color;"
		"Clear=Depth;"
		"ScriptExternal=Color;"
		
		"RenderColorTarget0=;"
		"RenderDepthStencilTarget=;"
		"ClearSetColor=ClearColor;"
		"ClearSetDepth=ClearDepth;"
		"Clear=Color;"
		"Clear=Depth;"
		"Pass=AutoToneExec;"
	;
	
> {
	pass AutoToneExec < string Script= "Draw=Buffer;"; > {
//		AlphaBlendEnable = FALSE;
		VertexShader = compile vs_2_0 VS_passDraw();
		PixelShader  = compile ps_2_0 PS_passAutoTone();
	}
}
//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
