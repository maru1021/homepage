//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@�G�b�W�u���[���{�J�� v0.1
//�@�@�@by ��������iuser/5145841�j
//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@���[�U�[�p�����[�^

//�@�񓧉߃��[�h�i 0: ���������͂��̂܂܏o�́A1: ���������𔒔w�i�Ƃ��ďo�́j
#define NON_TRANSPARENT 1

//�@DepthRT �΍�Ƃ��ĐF�␳���s���B�ʏ�o�͂Ɏg�p����ۂɐԐF���D�F�ɕς��ꍇ�� 0 �ɂ��ĉ������B
#define DOF_RT_MODE 1

//�@���掿���[�h�i 0�F��ʓI�Ȑ����e�N�X�`�����g���܂��B1 ���d��������G���[���o��ꍇ�Ɏg�p���ĉ������B
//�@�@�@�@�@�@�@�@ 1�F16bit ���������_���e�N�X�`�����g���܂��B���ɖ��Ȃ���΂���������g�p���������j
//�@�@�@�@�@�@�@�@ 2�FR �v�f�݂̂�32bit ���������_���e�N�X�`�����g���܂��BXDOF �� DepthRT ��p�j
#define HQ_MODE 1

//�@�񓧉߃��[�h 0 ���̔w�i�F�i0.0�F���F�A0.5�F�D�F�y�����l�Bo_disAlphaBlend�ƕ��p����ꍇ�����z�A1.0�F���F�j
#define B_COLOR 0.5

float strength		// 0.5 * Si
<
	string UIName = "���苭�x";
	string UIWidget = "Slider";
	bool UIVisible =  true;
	float UIMin = 1.0;
	float UIMax = 0.1;
> = 0.5;

//�@�G�b�W����\�����[�h�i 0: �ʏ폈���A1: �{�J��������\���j
#define SHOW_EDGE 0


//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@������`

//�@�����_�����O�^�[�Q�b�g�̃N���A�l
#if NON_TRANSPARENT
float4 ClearColor = {1,1,1,1};
#else
float4 ClearColor = {B_COLOR,B_COLOR,B_COLOR,0};
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

static float2 halfPixel = float2(1.0f, 1.0f) / (ViewportSize * 2);
static float2 fullPixel = float2(1.0f, 1.0f) / (ViewportSize);
static float AspectRatio = (ViewportSize.x / ViewportSize.y);


//�@�A�N�Z�T������ݒ�l���擾
float4 MaterialDiffuse : DIFFUSE  < string Object = "Geometry"; >;
static float alpha = MaterialDiffuse.a;

float scaling : CONTROLOBJECT < string name = "(self)"; >;
static float Scale = scaling * 0.1;

//�@�[�x�o�b�t�@
texture2D DepthBuffer : RENDERDEPTHSTENCILTARGET <
	float2 ViewPortRatio = {1.0,1.0};
	string Format = "D24S8";
>;

//�@�I���W�i���̕`�挋�ʂ��L�^���邽�߂̃����_�[�^�[�Q�b�g
texture2D ScnMap : RENDERCOLORTARGET <
	float2 ViewPortRatio = {1.0,1.0};
	int MipLevels = 1;
#if HQ_MODE == 1
	string Format = "A16B16G16R16F";
#elif HQ_MODE == 2
	string Format = "D3DFMT_R32F";
#else
	string Format = "A8R8G8B8";
#endif
>;
sampler2D ScnSamp = sampler_state {
	texture = <ScnMap>;
	MinFilter = LINEAR;
	MagFilter = LINEAR;
	MipFilter = NONE;
	AddressU  = CLAMP;
	AddressV = CLAMP;
};

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@���_�V�F�[�_
struct VS_OUTPUT {
	float4 Pos			: POSITION;
	float2 Tex			: TEXCOORD0;
};

VS_OUTPUT VS_passBlur( float4 Pos : POSITION, float4 Tex : TEXCOORD0 )
{
	VS_OUTPUT Out = (VS_OUTPUT)0; 
	
	Out.Pos = Pos;
	Out.Tex = Tex + ViewportOffset;
	
	return Out;
}

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@���̓s�N�Z���̐F�ƍ����邱�ƂŃ{�J��
static const float3 LumiFactor = {0.29891, 0.58661, 0.11448};

float4 PS_passBlur(float2 inTex: TEXCOORD0) : COLOR
{
	float4 Color;								//�@������̃s�N�Z���J���[���i�[
	float4 ColorOrg = tex2D( ScnSamp, inTex );	//�@�����O�̃s�N�Z���J���[���i�[

	Color = tex2D(ScnSamp, float2(inTex.x + halfPixel.x, inTex.y + halfPixel.y))
			+ tex2D(ScnSamp, float2(inTex.x + halfPixel.x, inTex.y - halfPixel.y))
			+ tex2D(ScnSamp, float2(inTex.x - halfPixel.x, inTex.y + halfPixel.y))
			+ tex2D(ScnSamp, float2(inTex.x - halfPixel.x, inTex.y - halfPixel.y));
	Color *= 0.25;

	float vDiff;
#if DOF_RT_MODE == 1	//�@DepthMap �΍􂪗L���ȏꍇ
	
	if(Color.g == 0 && Color.b == 0)
	{	//�@DepthMap �Ȃǂ̃����_�[�^�[�Q�b�g�Őԗv�f�ɂ����f�[�^�������Ă��Ȃ����̑΍�
		//�@vDiff = abs(dot(LumiFactor, Color.rgb) - dot(LumiFactor, ColorOrg.rgb));
		//�@vDiff * 1.3333333 �� �{�J�������l�i�ő�F0.75�j�̐��K��

		vDiff = abs(Color.r - ColorOrg.r);
		vDiff = saturate(pow(vDiff * 1.3333333, Scale * strength));

		Color.r = lerp(ColorOrg.r, Color.r, vDiff);
	} else {
#endif
		vDiff = abs(dot(Color.rgb - ColorOrg.rgb, LumiFactor));
		vDiff = saturate(pow(vDiff * 1.3333333, Scale * strength));

		Color = lerp(ColorOrg, Color, vDiff);
#if DOF_RT_MODE == 1
		}
#endif

#if SHOW_EDGE == 1
	vDiff = 1.0 - vDiff;
	return float4(vDiff,vDiff,vDiff,1);
#endif

	//�@�A�N�Z�T���̕s�����x�����ɃI���W�i���ƍ���
	return lerp(ColorOrg, Color, alpha);
}

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
technique Blur <
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
		"Pass=BlurExec;"
	;
	
> {
	pass BlurExec < string Script= "Draw=Buffer;"; > {
//		AlphaBlendEnable = FALSE;
		VertexShader = compile vs_2_0 VS_passBlur();
		PixelShader  = compile ps_2_0 PS_passBlur();
	}
}
//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
