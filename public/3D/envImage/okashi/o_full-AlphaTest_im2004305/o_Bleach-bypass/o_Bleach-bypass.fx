//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@��c�����t�B���^ v0.1a
//�@�@�@by ��������iuser/5145841�j
//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@���[�U�[�p�����[�^

//�@�񓧉߃��[�h�i 0: ���������͂��̂܂܏o�́A1: ���������𔒔w�i�Ƃ��ďo�́j
#define NON_TRANSPARENT 1

//�@�񓧉߃��[�h 0 ���̔w�i�F�i0.0�F���F�A0.5�F�D�F�y�����l�Bo_disAlphaBlend�ƕ��p����ꍇ�����z�A1.0�F���F�j
#define B_COLOR 0.5


//�@�ȈՐF���␳�i ��, ��, �i,���j�̏��Ɏw��A1�ŕω��Ȃ��j
//�@�@�����ݒ� 1.0, 1.0, 1.0, 1.0
float4 ColorFilter
<
   string UIName = "ColorFilter";
   string UIWidget = "Color";
   bool UIVisible =  true;
   float UIMin = float4( 0, 0, 0, 1);
   float UIMax = float4( 2, 2, 2, 1);
> = float4( 1.0, 1.0, 1.1, 1.0 );

//�@MMD�o�͂ƍ�������䗦�i0�ŕω��Ȃ��A1�ɋ߂Â��قǃG�t�F�N�g������������j
//�@�@�����ݒ� 0.9
float Strength
<
   string UIName = "Strength";
   string UIWidget = "Slider";
   bool UIVisible =  true;
   float UIMin = 0.0;
   float UIMax = 1.0;
> = float( 0.9 );


//�@���m�N�����A���S���Y���w��@������Ȃ��ꍇ�͏����l�̂܂܎g���Ă�������
//�@�@1:���ώZ�o�@�@2:BT.601(NTSC)�x�[�X�@3:BT.709(HDTV)�x�[�X�y�����l�z
#define MONO_ALGO 3
//�@BT.709�x�[�X�Ń��m�N��������ۂɗp����K���}�l�i��{: 2.2�A�����l�͈�: 1.0 �` 5.0�j
#define GAMMA 2.2

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
static float2 ViewportOffset = (float2(0.5,0.5) / ViewportSize);

//�@�A�N�Z�T������ݒ�l���擾
float4 MaterialDiffuse : DIFFUSE  < string Object = "Geometry"; >;
static float alpha = MaterialDiffuse.a;

float scaling0 : CONTROLOBJECT < string name = "(self)"; >;
static float scaling = scaling0 * 0.1;

float3 ObjXYZ0 : CONTROLOBJECT < string name = "(self)"; >;
static float3 ObjXYZ = ObjXYZ0 + 1.0;

//�@�g�[���␳�p�v���Z�b�g�r�b�g�}�b�v
texture2D Tone <
	string ResourceName = "o_Bleach-bypass.bmp";
	int MipLevels = 1;
	string Format = "A8R8G8B8" ;
>;
sampler ToneSamp = sampler_state{
	Texture = <Tone>;
	MinFilter = LINEAR;
	MagFilter = LINEAR;
	MipFilter = NONE;
	AddressU  = CLAMP;
	AddressV = CLAMP;
};

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

#if MONO_ALGO == 2		//�@�P�x�Z�o�@�iBT601:NTSC�j
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

VS_OUTPUT VS_passBleachBypass( float4 Pos : POSITION, float4 Tex : TEXCOORD0 )
{
	VS_OUTPUT Out = (VS_OUTPUT)0; 
	
	Out.Pos = Pos;
	Out.Tex = Tex + ViewportOffset;
	
	return Out;
}

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//�@�v���Z�b�g�r�b�g�}�b�v�����ɐF�̒u������

float4 PS_passBleachBypass(float2 Tex: TEXCOORD0) : COLOR
{
	float4 Color = tex2D( ScnSamp, Tex );	//�@������̃s�N�Z���J���[���i�[
	float4 ColorOrg = Color;				//�@�����O�̃s�N�Z���J���[���i�[
	float4 ColorMono;

		//�@R,G,B �ɋ��߂��P�x�����ă��m�N����
#if MONO_ALGO == 1		//�@���ώZ�o�@
	ColorMono.rgb = dot(Color.rgb, 0.3333333);

#elif MONO_ALGO == 2	//�@�P�x�Z�o�@�iBT601:NTSC�j
	ColorMono.rgb = dot(LumiFactor, Color.rgb);

#else					//�@�P�x�Z�o�@�iBT709:HDTV�j
	ColorMono.rgb = pow(Color.rgb, GAMMA);
	ColorMono.rgb = pow(dot(LumiFactor, ColorMono.rgb), 1.0 / GAMMA);
#endif

	//	�\�t�g���C�g����
	Color.rgb = ColorMono.rgb < 0.5 ? pow(Color.rgb, 2.0 * (1.0 - ColorMono.rgb))
									: pow(Color.rgb, 1.0 / (2.0 * ColorMono.rgb));

	Color.rgb = lerp(ColorMono.rgb, Color.rgb, 0.4 * scaling);

	//�@RGB�e�F�̒l����␳��̒l���e�N�X�`������ǂݍ���
	Color.r = tex2D( ToneSamp, float2(Color.r * 0.99607843 + 0.00196, 0.5)).r;
	Color.g = tex2D( ToneSamp, float2(Color.g * 0.99607843 + 0.00196, 0.5)).g;
	Color.b = tex2D( ToneSamp, float2(Color.b * 0.99607843 + 0.00196, 0.5)).b;

	//�@�F���␳�ʂ��Â��ɔ�Ⴓ���č���
    Color.rgb = lerp(Color.rgb * ColorFilter.rgb * ObjXYZ, Color.rgb, Color.rgb);

	//�@�A�N�Z�T���̕s�����x�����ɃI���W�i���ƍ���
	return lerp(ColorOrg, Color, Strength * alpha);
}

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
technique BleachBypass <
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
		"Pass=BleachBypassExec;"
	;
	
> {
	pass BleachBypassExec < string Script= "Draw=Buffer;"; > {
//		AlphaBlendEnable = FALSE;
		VertexShader = compile vs_2_0 VS_passBleachBypass();
		PixelShader  = compile ps_2_0 PS_passBleachBypass();
	}
}
//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
