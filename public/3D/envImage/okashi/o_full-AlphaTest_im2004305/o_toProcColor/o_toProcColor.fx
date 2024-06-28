//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@�v���Z�X�J���[�֒P���ϊ�����t�B���^�[ v0.1
//�@�@�@by ��������iuser/5145841�j
//
//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@���[�U�[�p�����[�^

//�@�񓧉߃��[�h�i 0: ���������͂��̂܂܏o�́A1: ���������𔒔w�i�Ƃ��ďo�́y�����l�z�j
#define NON_TRANSPARENT 0

//�@�������̔w�i�F�B�����������ɉe������B�i0.0�ō��w�i�A1.1�Ŕ��w�i�A�����l��0.5�j
#define B_COLOR 0.5

//�@�W�F���[�h�i 0: �R���g���X�g��ς��Ȃ��悤�ɕ␳����y�����l�z�A1: �蔲�������E�Ȃ�ƂȂ��W���Ȃ�܂��j
#define PALE_MODE 0

//�@�������[�h�i 0: �ȈՕϊ��ECMYK�̂݌v�Z����A 1: CMY�C���L�̍��F(RGB)���ǉ����Čv�Z����y�����l�z�j
#define HQ_MODE 1

//�@JAPANCOLOR_MODE 1 ���̖��ʐF�̈����i 0: JapanColor�̍��C���L�Ɋ�Â��A1: ���z�I�ȍ��E���b�`�u���b�N�iR=G=B=0�j�y�����l�z�j
#define NEUTRAL_GRAY 1

//�@���F�yR,G,B,C,M,Y,K�z�̐F�w��i 0: ���̎O���F�Ɋ�Â��E���Ӗ��A1: ���{�̃I�t�Z�b�g����ł̕W���F�Ɋ�Â��y�����l�z�j
#define JAPANCOLOR_MODE 1

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

#if JAPANCOLOR_MODE		//�@JapanColor �Ɋ�Â������F��RGB�l
 #define RGB_CYAN		float3(         0, 0.62745098, 0.91372549)
 #define RGB_MAGENTA	float3(0.89411765,          0, 0.49803922)
 #define RGB_YELLOW		float3(1.00000000, 0.94509804,          0)

 #define RGB_RED		float3(0.90196078,          0, 0.07058824)
 #define RGB_GREEN		float3(         0, 0.60000000, 0.26666667)
 #define RGB_BLUE		float3(0.11372549, 0.12549020, 0.53333333)

 #if (NEUTRAL_GRAY && !PALE_MODE)	//�@���F��RGB�l �オRGB���A����CMYK��
  #define RGB_KEY		float3(0.0, 0.0, 0.0)
 #else
  #define RGB_KEY		float3(0.13725490, 0.09411765, 0.08235294)
 #endif

#else					//�@���̎O���F�Ɋ�Â����F�B�ω����Ȃ����ߖ��Ӗ��ł���B
 #define RGB_CYAN		float3(0, 1, 1)
 #define RGB_MAGENTA	float3(1, 0, 1)
 #define RGB_YELLOW		float3(1, 1, 0)

 #define RGB_RED		float3(1, 0, 0)
 #define RGB_GREEN		float3(0, 1, 0)
 #define RGB_BLUE		float3(0, 0, 1)

 #define RGB_KEY		float3(0, 0, 0)
#endif

#define RGB_WHITE		float3(1.0, 1.0, 1.0)
#define RGB_1			float3(1.0, 1.0, 1.0)
#define RGB_0			float3(0.0, 0.0, 0.0)

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

float4 PS_passRGBtoCMYK(float2 Tex: TEXCOORD0) : COLOR
{   
	float4 Color;
	float4 ColorOrg = tex2D(ScnSamp, Tex);	//�@MMD�o�͂𓾂�

	//�@�F���␳�ʂ��Â��ɔ�Ⴓ���č���
    ColorOrg.rgb = lerp(ColorOrg.rgb * ColorFilter * ObjXYZ, ColorOrg.rgb, ColorOrg.rgb);

	float3 ColorCMYK = RGB_1 - ColorOrg.rgb;		//�@CYMK�𓾂�Br=C�Ag=M�Ab=Y
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

	Color.rgb = RGB_WHITE;	//�@���F ��K�p
	Color.rgb *= lerp(RGB_1, RGB_KEY, KEY);	//�@Key Plate ��K�p

#if HQ_MODE	//�@C,M,Y�̊e�v���[�g���d�Ȃ������̐F�iR,G,B�j��␳����B����̓C���L��������Ȃ���
	float BLUE  = min(CYAN, MAGENTA);
	float GREEN = min(CYAN, YELLOW);
	float RED   = min(MAGENTA, YELLOW);

  #if PALE_MODE
	MAGENTA -= BLUE + RED;
	CYAN    -= BLUE + GREEN;
	YELLOW  -= GREEN + RED;

  #else
	MAGENTA = (MAGENTA - BLUE - RED)   / ((1.0 - BLUE) * (1.0 - RED));
	CYAN    = (CYAN    - BLUE - GREEN) / ((1.0 - BLUE) * (1.0 - GREEN));
	YELLOW  = (YELLOW  - RED  - GREEN) / ((1.0 - RED)  * (1.0 - GREEN));

  #endif

	Color.rgb *= lerp(RGB_1, RGB_RED, RED);		//�@M + Y = R ��␳
	Color.rgb *= lerp(RGB_1, RGB_GREEN, GREEN);	//�@C + Y = G ��␳
	Color.rgb *= lerp(RGB_1, RGB_BLUE, BLUE);		//�@C + M = B ��␳
#endif
	Color.rgb *= lerp(RGB_1, RGB_CYAN, CYAN);			//�@Cyan Plate ��K�p
	Color.rgb *= lerp(RGB_1, RGB_MAGENTA, MAGENTA);	//�@Magenta Plate ��K�p
	Color.rgb *= lerp(RGB_1, RGB_YELLOW, YELLOW);		//�@Yellow Plate ��K�p

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

		VertexShader = compile vs_2_0 VS_passDraw();
		PixelShader  = compile ps_2_0 PS_passRGBtoCMYK();
	}
}
////////////////////////////////////////////////////////////////////////////////////////////////
