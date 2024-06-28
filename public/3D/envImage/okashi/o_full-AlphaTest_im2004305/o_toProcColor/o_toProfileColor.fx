//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@�v���Z�X�J���[�֒P���ϊ�����t�B���^�[ v0.1
//�@�@�@by ��������iuser/5145841�j
//
//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@���[�U�[�p�����[�^

//�@Profile�t�H���_���̃C���N�F�v���t�@�C�����w�肷��B��F"JapanColor_Coat"�A"Sepia" �Ȃ�
#define INK_PROFILE "JapanColor_Coat"

//�@�񓧉߃��[�h�i 0: ���������͂��̂܂܏o�́A1: ���������𔒔w�i�Ƃ��ďo�́y�����l�z�j
#define NON_TRANSPARENT 1

//�@�������̔w�i�F�B�����������ɉe������B�i0.0�ō��w�i�A1.1�Ŕ��w�i�A�����l��0.5�j
#define B_COLOR 0.5

//�@�W�F���[�h�i 0: �R���g���X�g��ς��Ȃ��悤�ɕ␳����y�����l�z�A1: �蔲�������E�Ȃ�ƂȂ��W���Ȃ�܂��j
#define PALE_MODE 0

//�@�������[�h�i 0: �ȈՕϊ��ECMYK�̂݌v�Z����A 1: CMY�C���L�̍��F(RGB)���ǉ����Čv�Z����y�����l�z�j
#define HQ_MODE 1

//�@���ʐF�̈����i 0: ���C���L�Ɋ�Â��A1: ���z�I�ȍ��y�����l�z�j
#define NEUTRAL_GRAY 0

//�@�ȈՐF���␳�i ��, ��, �i,���j�̏��Ɏw��A1�ŕω��Ȃ��j
//�@�@�����ݒ� 1.0, 1.0, 1.0, 1.0
float3 ColorFilter
<
   string UIName = "�ȈՐF���␳";
   string UIWidget = "Spinner";
   bool UIVisible =  true;
   float3 UIMin = float3( 0.0, 0.0, 0.0 );
   float3 UIMax = float3( 2.0, 2.0, 2.0 );
> = float3( 1.0, 1.0, 1.0 );

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@������`

//�@�g�[���␳�p�v���Z�b�g�r�b�g�}�b�v
texture2D Tone <
	string ResourceName = "Profile\\"INK_PROFILE".png";
	int MipLevels = 1;
	string Format = "X8R8G8B8";
>;
sampler ToneSamp = sampler_state{
	Texture = <Tone>;
	MinFilter = NONE;
	MagFilter = NONE;
	MipFilter = NONE;
	AddressU  = CLAMP;
	AddressV = CLAMP;
};

//�@�����_�����O�^�[�Q�b�g�̃N���A�l
#if NON_TRANSPARENT
float4 ClearColor = {1.0, 1.0, 1.0, 1.0};
#else
float4 ClearColor = {B_COLOR, B_COLOR, B_COLOR, 0.0};
#endif
float ClearDepth  = 1.0;

//�@�|�X�g�G�t�F�N�g�錾
float Script : STANDARDSGLOBAL <
	string ScriptOutput = "color";
	string ScriptClass = "scene";
	string ScriptOrder = "postprocess";
> = 0.8;

//�@�A�N�Z�T������ݒ�l���擾
float4 MaterialDiffuse : DIFFUSE  < string Object = "Geometry"; >;
static float alpha1 = MaterialDiffuse.a;

float scaling0 : CONTROLOBJECT < string name = "(self)"; >;
static float scaling = scaling0 * 0.1;

float3 ObjXYZ0 : CONTROLOBJECT < string name = "(self)"; >;
static float3 ObjXYZ = ObjXYZ0 + 1.0;

//�@�X�N���[���T�C�Y
float2 ViewportSize : VIEWPORTPIXELSIZE;
static float2 ViewportOffset = (float2(0.5,0.5)/ViewportSize);

//�@�[�x�o�b�t�@
texture2D DepthBuffer : RENDERDEPTHSTENCILTARGET <
	float2 ViewPortRatio = {1.0,1.0};
	string Format = "D24S8";
>;

//�@�I���W�i���̕`�挋�ʂ��L�^���邽�߂̃����_�[�^�[�Q�b�g
texture2D ScnMap : RENDERCOLORTARGET <
	float2 ViewPortRatio = {1.0,1.0};
	int MipLevels = 1;
	int AntiAlias = 1;
	string Format = "A8R8G8B8";
>;
sampler2D ScnSamp = sampler_state {
	texture = <ScnMap>;
	MinFilter = NONE;
	MagFilter = NONE;
	MipFilter = NONE;
	AddressU  = CLAMP;
	AddressV = CLAMP;
};

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@���ʒ��_�V�F�[�_
struct VS_OUTPUT {
	float4 Pos			: POSITION;
	float2 Tex			: TEXCOORD0;
};

VS_OUTPUT VS_passDraw( float4 Pos : POSITION, float4 Tex : TEXCOORD0 ) {
	VS_OUTPUT Out = (VS_OUTPUT)0; 
	
	Out.Pos = Pos;
	Out.Tex = Tex + ViewportOffset;
	
	return Out;
}


//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@RGB��CMYK�ɕϊ����C���L�F������RGB�ɍĕϊ�����
#define COLOR_GRID (1.0 / 16.0) + (1.0 / 8.0)
static const float3 RGB_WHITE   = tex2D(ToneSamp, float2( COLOR_GRID * 0, 0.5)).rgb;
static const float3 RGB_RED     = tex2D(ToneSamp, float2( COLOR_GRID * 1, 0.5)).rgb;
static const float3 RGB_YELLOW  = tex2D(ToneSamp, float2( COLOR_GRID * 2, 0.5)).rgb;
static const float3 RGB_GREEN   = tex2D(ToneSamp, float2( COLOR_GRID * 3, 0.5)).rgb;
static const float3 RGB_CYAN    = tex2D(ToneSamp, float2( COLOR_GRID * 4, 0.5)).rgb;
static const float3 RGB_BLUE    = tex2D(ToneSamp, float2( COLOR_GRID * 5, 0.5)).rgb;
static const float3 RGB_MAGENTA = tex2D(ToneSamp, float2( COLOR_GRID * 6, 0.5)).rgb;
#if NEUTRAL_GRAY
static const float3 RGB_KEY     = float3(0,0,0);
#else
static const float3 RGB_KEY     = tex2D(ToneSamp, float2( COLOR_GRID * 7, 0.5)).rgb;
#endif

float4 PS_passRGBtoCMYK(float2 Tex: TEXCOORD0) : COLOR
{
	float4 Color;
	float4 ColorOrg = tex2D(ScnSamp, Tex);	//�@MMD�o�͂𓾂�

	float3 ColorCMYK = 1.0 - ColorOrg.rgb;		//�@CYMK�𓾂�Br=C�Ag=M�Ab=Y
	float KEY = min(ColorCMYK.r, min(ColorCMYK.g, ColorCMYK.b));	//�@Key Plate = Black

#if PALE_MODE
	ColorCMYK.rgb -= KEY;
#else
	ColorCMYK.rgb = KEY < 1.0 ? (ColorCMYK.rgb - KEY) / (1.0 - KEY) : 0.0;
//	ColorCMYK.rgb = (ColorCMYK.rgb - KEY) / (1.0 - KEY);	//�@�������̂ق������������c
#endif

	// ColorCMYK.rgb ���ƍ�������̂ŕ���Ղ��ϐ����ɑ��
	float CYAN    = ColorCMYK.r;
	float MAGENTA = ColorCMYK.g;
	float YELLOW  = ColorCMYK.b;

	Color.rgb = RGB_WHITE;	//�@���F��K�p
	Color.rgb *= lerp(1.0, RGB_KEY, KEY);	//�@Key Plate ��K�p

#if HQ_MODE	//�@C,M,Y�̊e�v���[�g���d�Ȃ������̐F�iR,G,B�j��␳����B����̓C���L��������Ȃ���
	float BLUE = min(CYAN, MAGENTA);
	MAGENTA -= BLUE;
	CYAN    -= BLUE;

	float GREEN = min(CYAN, YELLOW);
	YELLOW -= GREEN;
	CYAN   -= GREEN;

	float RED = min(MAGENTA, YELLOW);
	YELLOW  -= RED;
	MAGENTA -= RED;

  #if PALE_MODE == 0
	MAGENTA /= 1.0 - BLUE;
	CYAN    /= 1.0 - BLUE;

	YELLOW  /= 1.0 - GREEN;
	CYAN    /= 1.0 - GREEN;

	YELLOW  /= 1.0 - RED;
	MAGENTA /= 1.0 - RED;
  #endif

	Color.rgb *= lerp(1.0, RGB_RED, RED);		//�@M + Y = R ��␳
	Color.rgb *= lerp(1.0, RGB_GREEN, GREEN);	//�@C + Y = G ��␳
	Color.rgb *= lerp(1.0, RGB_BLUE, BLUE);		//�@C + M = B ��␳
#endif
	Color.rgb *= lerp(1.0, RGB_CYAN, CYAN);			//�@Cyan Plate ��K�p
	Color.rgb *= lerp(1.0, RGB_MAGENTA, MAGENTA);	//�@Magenta Plate ��K�p
	Color.rgb *= lerp(1.0, RGB_YELLOW, YELLOW);		//�@Yellow Plate ��K�p

	//�@�F���␳�ʂ��Â��ɔ�Ⴓ���č���
    Color.rgb = lerp(Color.rgb * ColorFilter * ObjXYZ, Color.rgb, Color.rgb);

	//�@�A�N�Z�T���̕s�����x�����ɃI���W�i���ƍ���
	Color = lerp(ColorOrg, Color, alpha1);

#if NON_TRANSPARENT
	Color.a = 1.0;
#else
	Color.a = ColorOrg.a;
#endif

	return Color;
}

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

technique o_ProcColor <
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
		"Pass=RGBtoCMYK;"
	;
	
> {
	pass RGBtoCMYK < string Script= "Draw=Buffer;"; > {
		AlphaBlendEnable = FALSE;

		VertexShader = compile vs_3_0 VS_passDraw();
		PixelShader  = compile ps_3_0 PS_passRGBtoCMYK();
	}
}
////////////////////////////////////////////////////////////////////////////////////////////////
