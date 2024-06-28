////////////////////////////////////////////////////////////////////////////////////////////////
//
// MirrorEmittionDraw for WorkingFloorAL.fx
//
////////////////////////////////////////////////////////////////////////////////////////////////
//�I�v�V�����X�C�b�`(AL_Texture.fxsub�Ɠ����ݒ�ɂ��邱��)

//���������������O�ʂɉ����o��
// 0�Ŗ����A1�ŗL��
#define POPUP_LIGHT 0

//�e�N�X�`�����P�x���ʃt���O
#define TEXTURE_SELECTLIGHT

//臒l
float LightThreshold = 0.9;

//�t���[�����ɓ��������邩�ǂ���
#define SYNC  false

////////////////////////////////////////////////////////////////////////////////////////////////
// �A�N�Z�ɑg�ݍ��ޏꍇ�͂�����K�X�ύX���Ă��������D
float3 MirrorPos = float3( 0.0, 0.0, 0.0 );    // ���[�J�����W�n�ɂ����鋾�ʏ�̔C�ӂ̍��W(�A�N�Z���_���W�̈�_)
float3 MirrorNormal = float3( 0.0, 1.0, 0.0 ); // ���[�J�����W�n�ɂ����鋾�ʂ̖@���x�N�g��

///////////////////////////////////////////////////////////////////////////////////////////////
// ���ʍ��W�ϊ��p�����[�^
float4x4 MirrorWorldMatrix: CONTROLOBJECT < string Name = "(OffscreenOwner)"; >; // ���ʃA�N�Z�̃��[���h�ϊ��s��

// ���[���h���W�n�ɂ����鋾���ʒu�ւ̕ϊ�
static float3 WldMirrorPos = mul( float4(MirrorPos, 1.0f), MirrorWorldMatrix ).xyz;
static float3 WldMirrorNormal = normalize( mul( MirrorNormal, (float3x3)MirrorWorldMatrix ) );

// ���W�̋����ϊ�
float4 TransMirrorPos( float4 Pos )
{
    Pos.xyz -= WldMirrorNormal * 2.0f * dot(WldMirrorNormal, Pos.xyz - WldMirrorPos);
    return Pos;
}

float3 CameraPosition : POSITION  < string Object = "Camera"; >;

// ���ʕ\������(���W�ƃJ�������������ʂ̕\���ɂ��鎞�����{)
float IsFace( float4 Pos )
{
    return min( dot(Pos.xyz-WldMirrorPos, WldMirrorNormal),
                dot(CameraPosition-WldMirrorPos, WldMirrorNormal) );
}

///////////////////////////////////////////////////////////////////////////////////////////////

#define SPECULAR_BASE 100

bool use_toon;     //�g�D�[���̗L��

// �}�e���A���F
float4   MaterialDiffuse   : DIFFUSE  < string Object = "Geometry"; >;
float3   MaterialAmbient   : AMBIENT  < string Object = "Geometry"; >;
float3   MaterialEmmisive  : EMISSIVE < string Object = "Geometry"; >;
float3   MaterialSpecular  : SPECULAR < string Object = "Geometry"; >;
float    SpecularPower     : SPECULARPOWER < string Object = "Geometry"; >;

// ���W�ϊ��s��
float4x4 WorldMatrix    : WORLD;
float4x4 ViewMatrix     : VIEW;
float4x4 ProjMatrix     : PROJECTION;
float4x4 ViewProjMatrix : VIEWPROJECTION;

#define PI 3.14159

float LightUp : CONTROLOBJECT < string name = "(self)"; string item = "LightUp"; >;
float LightUpE : CONTROLOBJECT < string name = "(self)"; string item = "LightUpE"; >;
float LightOff : CONTROLOBJECT < string name = "(self)"; string item = "LightOff"; >;
float Blink : CONTROLOBJECT < string name = "(self)"; string item = "LightBlink"; >;
float BlinkSq : CONTROLOBJECT < string name = "(self)"; string item = "LightBS"; >;
float BlinkDuty : CONTROLOBJECT < string name = "(self)"; string item = "LightDuty"; >;
float BlinkMin : CONTROLOBJECT < string name = "(self)"; string item = "LightMin"; >;
float LClockUp : CONTROLOBJECT < string name = "(self)"; string item = "LClockUp"; >;
float LClockDown : CONTROLOBJECT < string name = "(self)"; string item = "LClockDown"; >;

//����
float ftime : TIME <bool SyncInEditMode = SYNC;>;

static float duty = (BlinkDuty <= 0) ? 0.5 : BlinkDuty;
static float timerate = ((Blink > 0) ? ((1 - cos(saturate(frac(ftime / (Blink * 10)) / (duty * 2)) * 2 * PI)) * 0.5) : 1.0)
                      * ((BlinkSq > 0) ? (frac(ftime / (BlinkSq * 10)) < duty) : 1.0);
static float timerate1 = timerate * (1 - BlinkMin) + BlinkMin;

static float ClockShift = (1 + LClockDown * 5) / (1 + LClockUp * 5);

static bool IsEmittion = (SPECULAR_BASE < SpecularPower)/* && (SpecularPower <= (SPECULAR_BASE + 100))*/ && (length(MaterialSpecular) < 0.01);
static float EmittionPower0 = IsEmittion ? ((SpecularPower - SPECULAR_BASE) / 7.0) : 1;
static float EmittionPower1 = EmittionPower0 * (LightUp * 2 + 1.0) * pow(400, LightUpE) * (1.0 - LightOff);



/// �I�u�W�F�N�g�̃e�N�X�`��
texture ObjectTexture: MATERIALTEXTURE;
sampler ObjTexSampler = sampler_state {
    texture = <ObjectTexture>;
    MINFILTER = LINEAR;
    MAGFILTER = LINEAR;
    MIPFILTER = LINEAR;
    ADDRESSU  = WRAP;
    ADDRESSV  = WRAP;
};


////////////////////////////////////////////////////////////////////////////////////////////////
//MMM�Ή�

#ifndef MIKUMIKUMOVING
    struct VS_INPUT{
        float4 Pos    : POSITION;
        float2 Tex    : TEXCOORD0;
        float4 AddUV1 : TEXCOORD1;
        float4 AddUV2 : TEXCOORD2;
        float4 AddUV3 : TEXCOORD3;
        float4 Normal : NORMAL;
    };
    #define MMM_SKINNING
    #define GETPOS     (IN.Pos)
    #define GETNORMAL  (IN.Normal)
    #define GET_VPMAT(p) (ViewProjMatrix)
#else
    #define VS_INPUT  MMM_SKINNING_INPUT
    #define MMM_SKINNING  MMM_SKINNING_OUTPUT SkinOut = MMM_SkinnedPositionNormal(IN.Pos, IN.Normal, IN.BlendWeight, IN.BlendIndices, IN.SdefC, IN.SdefR0, IN.SdefR1);
    #define GETPOS     (SkinOut.Position)
    #define GETNORMAL  (SkinOut.Normal)
    #define GET_VPMAT(p) (MMM_IsDinamicProjection ? mul(ViewMatrix, MMM_DynamicFov(ProjMatrix, length(CameraPosition-p.xyz))) : ViewProjMatrix)
#endif

///////////////////////////////////////////////////////////////////////////////////////////////

float texlight(float3 rgb){
    float val = saturate((length(rgb) - LightThreshold) * 3);
    val *= 0.2;
    return val;
}

///////////////////////////////////////////////////////////////////////////////////////////////

float3 HSV_to_RGB(float3 hsv){
    float H = frac(hsv.x);
    float S = hsv.y;
    float V = hsv.z;
    
    float3 Color = 0;
    
    float Hp3 = H * 6.0;
    float h = floor(Hp3);
    float P = V * (1 - S);
    float Q = V * (1 - S * (Hp3 - h));
    float T = V * (1 - S * (1 - (Hp3 - h)));
    
    Color.rgb += float3(V, T, P) * max(0, 1 - abs(h - 0));
    Color.rgb += float3(Q, V, P) * max(0, 1 - abs(h - 1));
    Color.rgb += float3(P, V, T) * max(0, 1 - abs(h - 2));
    Color.rgb += float3(P, Q, V) * max(0, 1 - abs(h - 3));
    Color.rgb += float3(T, P, V) * max(0, 1 - abs(h - 4));
    Color.rgb += float3(V, P, Q) * max(0, 1 - abs(h - 5));
    
    return Color;
}

///////////////////////////////////////////////////////////////////////////////////////////////
// �ǉ�UV��AL�p�f�[�^���ǂ�������

bool DecisionSystemCode(float4 SystemCode){
    bool val = (0.199 < SystemCode.r) && (SystemCode.r < 0.201)
            && (0.699 < SystemCode.g) && (SystemCode.g < 0.701);
    return val;
}


float4 getFlags(float flagcode){
    float4 val = frac(flagcode * float4(0.1, 0.01, 0.001, 0.0001));
    val = floor(val * 10 + 0.001);
    return val;
}

///////////////////////////////////////////////////////////////////////////////////////////////
// �I�u�W�F�N�g�`��i�Z���t�V���h�EOFF�j

struct VS_OUTPUT {
    float4 Pos        : POSITION;    // �ˉe�ϊ����W
    float4 Color      : COLOR0;      // �F
    float4 Tex        : TEXCOORD0;   // UV
    float4 WPos       : TEXCOORD1;   // �������̃��[���h���W
};

// ���_�V�F�[�_
VS_OUTPUT Basic_VS(VS_INPUT IN)
{
    VS_OUTPUT Out = (VS_OUTPUT)0;
    MMM_SKINNING

    float4 SystemCode = IN.AddUV1;
    float4 ColorCode  = IN.AddUV2;
    float4 AppendCode = IN.AddUV3;

    bool IsALCode = DecisionSystemCode(SystemCode);
    float4 flags = getFlags(SystemCode.w);

    // �@�����[���h�ϊ�
    float3 Normal = normalize( mul( GETNORMAL, (float3x3)WorldMatrix ) );

    // ���[���h���W�ϊ�
    float4 Pos = mul( GETPOS, WorldMatrix );
    Pos.xyz += float(IsALCode) * AppendCode.z * Normal;
    Out.WPos = Pos; // ���[���h���W

    // �����ʒu�ւ̍��W�ϊ�
    Pos = TransMirrorPos( Pos ); // �����ϊ�

    // �J�������_�̃r���[�ˉe�ϊ�
    Out.Pos = mul( Pos, GET_VPMAT(Pos) );
    Out.Pos.x *= -1.0f; // �|���S�������Ԃ�Ȃ��悤�ɍ��E���]�ɂ��ĕ`��

    // �����F
    Out.Color = MaterialDiffuse;
    Out.Color.rgb += MaterialEmmisive / 2;
    Out.Color.rgb *= 0.5;
    Out.Color.rgb = IsEmittion ? Out.Color.rgb : float3(0,0,0);

    // ���_���� ////////////////////////
    float3 UVColor = ColorCode.rgb;
    UVColor = lerp(UVColor, HSV_to_RGB(UVColor), flags.y);
    UVColor *= ColorCode.a;
    Out.Color.rgb += IsALCode ? UVColor : float3(0,0,0);
    float Tv = SystemCode.z * ClockShift;
    float Ph = AppendCode.y * ClockShift;
    float timerate2 = (Tv > 0) ? ((1 - cos(saturate(frac((ftime + Ph) / Tv) / (duty * 2)) * 2 * PI)) * 0.5)
                     : ((Tv < 0) ? (frac((ftime + Ph) / (-Tv / PI * 180)) < duty) : 1.0);
    Out.Color.rgb *= max(timerate2 * (1 - BlinkMin) + BlinkMin, !IsALCode);
    Out.Color.rgb *= max(timerate1, SystemCode.z != 0);

    // �e�N�X�`��UV
    Out.Tex.xy = IN.Tex;
    Out.Tex.z = IsALCode * AppendCode.x;
    Out.Tex.w = IsALCode * flags.x;

    #if POPUP_LIGHT
        Out.Pos.z -= 0.01 * saturate(length(Out.Color.rgb));
    #endif

    return Out;
}

// �s�N�Z���V�F�[�_
float4 Basic_PS(VS_OUTPUT IN, uniform bool useTexture) : COLOR0
{
    // ���ʂ̗����ɂ��镔�ʂ͋����\�����Ȃ�
    clip( IsFace( IN.WPos ) );

    float4 Color = IN.Color;
    if(useTexture){
        float4 texcolor = tex2D(ObjTexSampler,IN.Tex.xy);
        texcolor.rgb = saturate(texcolor.rgb - IN.Tex.z);
        #ifdef TEXTURE_SELECTLIGHT
            Color = texcolor;
            Color.rgb *= texlight(Color.rgb);
        #else
            float Color2, Color3;
            Color2 = Color * texcolor;
            Color3 = Color * texlight(texcolor);
            Color = (IN.Tex.w < 0.1) ? Color2 : ((IN.Tex.w < 1.1) ? Color : Color3);
        #endif
    }

    Color.rgb *= lerp(EmittionPower0, EmittionPower1, (float)use_toon);

    return Color;
}


///////////////////////////////////////////////////////////////////////////////////////////////
// �I�u�W�F�N�g�`��p�e�N�j�b�N

technique MainTec1 < string MMDPass = "object"; bool UseTexture = false; >
{
    pass DrawObject {
        VertexShader = compile vs_3_0 Basic_VS();
        PixelShader  = compile ps_3_0 Basic_PS(false);
    }
}

technique MainTec2 < string MMDPass = "object"; bool UseTexture = true; >
{
    pass DrawObject {
        VertexShader = compile vs_3_0 Basic_VS();
        PixelShader  = compile ps_3_0 Basic_PS(true);
    }
}


technique MainTecBS1 < string MMDPass = "object_ss"; bool UseTexture = false; >
{
    pass DrawObject {
        VertexShader = compile vs_3_0 Basic_VS();
        PixelShader  = compile ps_3_0 Basic_PS(false);
    }
}

technique MainTecBS2 < string MMDPass = "object_ss"; bool UseTexture = true; >
{
    pass DrawObject {
        VertexShader = compile vs_3_0 Basic_VS();
        PixelShader  = compile ps_3_0 Basic_PS(true);
    }
}


///////////////////////////////////////////////////////////////////////////////////////////////

//�e��֊s�͕`�悵�Ȃ�
technique EdgeTec < string MMDPass = "edge"; > { }
technique ShadowTec < string MMDPass = "shadow"; > { }

